import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up Google GenAI Client
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

app.use(express.json({ limit: "5mb" }));

// Helper to write WAV header for 24kHz, 16-bit, Mono PCM audio
function writeWavHeader(pcmBuffer: Buffer, sampleRate: number = 24000, numChannels: number = 1, bitsPerSample: number = 16): Buffer {
  const header = Buffer.alloc(44);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;

  // RIFF identifier
  header.write("RIFF", 0);
  header.writeUInt32LE(chunkSize, 4);
  // WAVE identifier
  header.write("WAVE", 8);
  // FMT sub-chunk identifier
  header.write("fmt ", 12);
  // Sub-chunk size (16 for PCM)
  header.writeUInt32LE(16, 16);
  // Audio format (1 for PCM)
  header.writeUInt16LE(1, 20);
  // Number of channels
  header.writeUInt16LE(numChannels, 22);
  // Sample rate
  header.writeUInt32LE(sampleRate, 24);
  // Byte rate
  header.writeUInt32LE(byteRate, 28);
  // Block align
  header.writeUInt16LE(blockAlign, 32);
  // Bits per sample
  header.writeUInt16LE(bitsPerSample, 34);
  // Data sub-chunk identifier
  header.write("data", 36);
  // Data chunk size
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// Helper to format Gemini API errors, specifically handling 429 quota limits
function formatGeminiError(error: any, isTts: boolean = false): string {
  const errorStr = typeof error === "object" ? JSON.stringify(error) : String(error);
  const errorMessage = error?.message || error?.statusText || String(error);
  
  if (
    errorStr.includes("429") || 
    errorStr.includes("quota") || 
    errorStr.includes("RESOURCE_EXHAUSTED") || 
    errorMessage.includes("quota") || 
    errorMessage.includes("RESOURCE_EXHAUSTED") ||
    errorStr.includes("Quota exceeded")
  ) {
    if (isTts) {
      return "နှောင့်နှေးမှုအတွက် တောင်းပန်ပါသည်။ Gemini Text-to-Speech (TTS) ၏ တစ်နေ့လျှင် ၁၀ ကြိမ်သာရသော အခမဲ့အသုံးပြုခွင့် (Free Tier Quota Limit) ပြည့်သွားပါပြီ။ ဆက်လက်အသုံးပြုရန် Settings > Secrets တွင် သင့်ကိုယ်ပိုင် Billing-enabled ဖြစ်သော API Key ကို ထည့်သွင်းပေးပါ သို့မဟုတ် နောက်တစ်နေ့တွင် ထပ်မံစမ်းသပ်ပေးပါ။ (The daily free tier limit of 10 requests for Gemini TTS has been exceeded. Please add your own billing-enabled API Key in Settings > Secrets or try again tomorrow.)";
    }
    return "Gemini API ၏ အခမဲ့အသုံးပြုမှုအကန့်အသတ် (Free Tier Quota Limit) ပြည့်သွားပါပြီ။ ကျေးဇူးပြု၍ Settings > Secrets တွင် သင့်ကိုယ်ပိုင် API Key ကို ထည့်သွင်းပေးပါ သို့မဟုတ် နောက်တစ်နေ့တွင် ထပ်မံကြိုးစားကြည့်ပေးပါ။ (The free tier limit for Gemini API has been exceeded. Please configure your own API key in Settings > Secrets or try again tomorrow.)";
  }
  
  return errorMessage || "An unexpected error occurred.";
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Endpoint: Optimize Burmese Text for Storytelling TTS
app.post("/api/optimize", async (req, res) => {
  try {
    const { text, style, voiceDetails } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Myanmar text is required" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured in environment variables." });
    }

    const systemInstruction = `You are an elite Myanmar (Burmese) language voice director and storytelling script optimizer.
Your goal is to optimize the given Burmese text so that it sounds extremely natural, expressive, and cinematic when read by a native Text-to-Speech (TTS) engine.

You MUST perform these automated optimization tasks:
1. Fix Burmese Punctuation: Ensure standard Burmese commas (၊) and periods (။) are used with absolute precision. Replace any western punctuation (such as English periods, commas, or semicolons) with authentic Burmese punctuation.
2. Insert Natural breathing pauses: Carefully insert commas (၊), periods (။), or occasional ellipses (...) at natural breathing points to break up long winded phrases, avoid robotic rhythm, and establish a natural, poetic storytelling flow. Add ellipses (...) where useful to indicate dramatic pauses.
3. Split very long sentences: Divide overly long or complex Burmese sentences into shorter, more digestible sentences to improve the delivery and flow, while keeping names unchanged and preserving the original meaning exactly.
4. Improve rhythm for storytelling: Adjust the pacing and phrasing slightly so it flows beautifully with a storytelling rhythm.
5. Keep names unchanged: Do NOT translate, modify, or change any names or titles.
6. Improve numbers and dates for pronunciation: Convert all digits (e.g., 1, 2, 3), years (e.g., 2026), English acronyms (e.g., AI, USD), and common symbols into their complete, native Burmese phonetic written equivalents (e.g., "2026" becomes "နှစ်ထောင့်နှစ်ဆယ်ခြောက်", "AI" becomes "အေအိုင်") so the TTS reads them with flawless native pronunciation.
7. Preserve original meaning exactly: You are STRICTLY FORBIDDEN from rewriting or altering the core literary meaning, vocabulary, or storyline. Do NOT add new story content, and do NOT remove any sentence.

Style Context: "${style}" (${voiceDetails})`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Please optimize this Burmese text for TTS storytelling:\n\n${text}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimizedText: {
              type: Type.STRING,
              description: "The fully optimized Burmese text with natural punctuation, expanded numbers, and conversational pacing.",
            },
            changes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Specific adjustments made (e.g., spelled out dates, added breathing commas, balanced syllables).",
            },
            storytellingTips: {
              type: Type.STRING,
              description: "A short professional performance advice for reading this text in the selected style.",
            },
          },
          required: ["optimizedText", "changes", "storytellingTips"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from Gemini optimization service");
    }

    const parsedResult = JSON.parse(resultText);
    res.json(parsedResult);
  } catch (error: any) {
    console.error("Optimization error:", error);
    const formattedMessage = formatGeminiError(error, false);
    res.status(500).json({ error: formattedMessage });
  }
});

// Endpoint: Generate Speech (TTS)
app.post("/api/tts", async (req, res) => {
  try {
    const { 
      text, 
      style, 
      voiceName, 
      speed, 
      pitch, 
      pauseStrength, 
      emotionLevel, 
      expressiveness, 
      voiceWarmth,
      useSmartNarration 
    } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Text is required for TTS generation." });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured in environment variables." });
    }

    // Determine target voice name (Fenrir, Kore, Puck, Charon, Zephyr)
    const voice = voiceName || "Kore"; 

    // 11. Internal Narrator Prompt (prepended before every generation)
    const internalNarratorPrompt = `You are the best professional Burmese audiobook narrator.

Speak exactly like an experienced human storyteller.

Your narration must feel completely natural.

Never sound robotic.

Use realistic pacing.

Pause naturally.

Maintain emotional continuity.

Preserve every Burmese word exactly.

Do not rewrite.

Do not translate.

Sound warm, cinematic and believable.`;

    const dynamicPacingAndEmotionGuideline = `
===========================================================
BURMESE AUDIOBOOK NARRATOR ENGINE v5 RULES:
===========================================================

1. HUMAN SPEECH ENGINE & STORYTELLING FLOW
- Speak with a completely natural human sentence rhythm and dynamic pacing.
- Ensure smooth transitions between clauses. Avoid repetitive robotic cadences or flat intonations.
- The tone must be that of a premium, professional audiobook narrator or documentary storyteller.

2. BURMESE PRONUNCIATION INTELLIGENCE
- Preserve every Burmese word exactly as written. Never rewrite or translate.
- Correct pronunciation of:
  • Historical names (e.g., အနော်ရထာ, ကျန်စစ်သား, ဘုရင့်နောင်, မင်းတုန်းမင်း, သီပေါမင်း)
  • Royal titles (e.g., မင်းကြီး, မိဖုရား, အိမ်ရှေ့မင်း, သီရိသုဓမ္မရာဇာ)
  • Pagodas (e.g., ရွှေတိဂုံ, အာနန္ဒာ, သဗ္ဗညု, ကောင်းမှုတော်, ကျိုက်ထီးရိုး)
  • Cities (e.g., ရန်ကုန်, မန္တလေး, နေပြည်တော်, ပုဂံ, တောင်ကြီး, မော်လမြိုင်)
  • Buddhist terminology (e.g., သံဃာ, ဘုရား, တရား, နိဗ္ဗာန်, ကုသိုလ်, ဝိပဿနာ, ဥပုသ်, ဓမ္မ)
  • Numbers & Years (e.g., သုည, တစ်, နှစ်, သုံး, လေး, ငါး, ခြောက်, ခုနစ်, ရှစ်, ကိုး, ဆယ်, သက္ကရာဇ်)
  • Foreign names (e.g., အမေရိကန်, ဂျပန်, လန်ဒန်, အိုင်စတိုင်း)

3. INTELLIGENT PAUSE ENGINE
- Automatically analyze punctuation and semantics to insert realistic pauses.
- Short pause: Insert a tiny breathing pause at Burmese commas (၊).
- Medium pause: Insert a resting pause at Burmese full stops (။).
- Long pause: Insert a suspenseful pause at paragraph breaks, emotional scene changes, or suspense moments.
- STRICT WARNING: NEVER insert pauses inside names or numbers (e.g. do not pause inside "ယုန်ကလေး" or "နှစ်ထောင့်နှစ်ဆယ်ခြောက်").

4. EMOTION DETECTION & CINEMATIC EXPRESSION
- Automatically classify each paragraph's mood as: calm, romantic, mysterious, documentary, sad, inspirational, or dramatic.
- Apply subtle emotional expression fitting the classification. NEVER exaggerate or sound overacted.
- The voice should be warm, relaxed, confident, expressive, and believable.

5. DYNAMIC SPEAKING SPEED
- Dynamically adjust the speaking speed according to the emotional tone:
  • Slow: For emotional scenes, mystery, or suspense.
  • Normal: For standard narration, exposition, and explanation.
  • Slightly faster: For high-action scenes or intense moments.
- Ensure transitions between speeds are completely smooth.

6. NATURAL BREATHING & CONTEXT AWARENESS
- Insert tiny, natural breathing opportunities (inhales/exhales) only where a real human narrator would naturally breathe. Never overuse breathing.
- Analyze the surrounding sentences before generating speech to maintain complete emotional continuity across paragraphs.

7. PRONUNCIATION MEMORY & CONSISTENCY
- Keep proper names, titles, and places pronounced with absolute consistency every time they appear.

8. QUALITY VALIDATOR
- Before outputting the final audio, internally verify: pronunciation, pauses, emotion, rhythm, pacing, and consistency. If quality is below target, refine and improve internally before generating.`;
const childGirlVoicePrompt = `
VOICE DESIGN:

Perform this as a highly natural 12-year-old Burmese girl.

Voice Profile:
A highly natural 12-year-old Burmese girl.

Speaking Style:
Warm, innocent, expressive, emotionally rich, imaginative, energetic but soft.

Emotion:
Natural emotional transitions, gentle happiness, sadness, surprise, curiosity, excitement.

Delivery:
Professional voice acting quality with smooth pacing and realistic breathing.

Accent:
Native Myanmar Burmese.

Tone:
Young, pure, sweet, believable, cinematic narration.

Avoid:
Adult resonance.
Old woman voice.
Deep mature female voice.
Robotic tone.
Monotone delivery.

Never sound older than 14.
`;
const prompt = `
${childGirlVoicePrompt}

${internalNarratorPrompt}

Voice Acting Direction:
Speak as a highly natural 12-year-old Burmese girl.
Use warm, innocent, sweet, youthful tone.
Use emotional storytelling, gentle excitement, curiosity, sadness, and surprise.
Avoid adult resonance, deep mature female tone, robotic tone, and monotone delivery.

Burmese Text to Speak:
<speak>
${text}
</speak>`;

    const ttsModel = process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
    console.log(`Generating speech using native TTS model ${ttsModel}, voice ${voice} for text length ${text.length}`);

    const response = await ai.models.generateContent({
      model: ttsModel,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error(`No audio data returned from ${ttsModel}.`);
    }

    // Convert the base64 PCM to wav format
    const pcmBuffer = Buffer.from(base64Audio, "base64");
    const wavBuffer = writeWavHeader(pcmBuffer, 24000, 1, 16);

    res.setHeader("Content-Type", "audio/wav");
    res.send(wavBuffer);
  } catch (error: any) {
    console.error("TTS generation error:", error);
    const formattedMessage = formatGeminiError(error, true);
    res.status(500).json({ error: formattedMessage });
  }
});

// Configure Vite or serve static assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Myanmar AI Story Voice Studio running on port ${PORT}`);
  });
}

startServer();
