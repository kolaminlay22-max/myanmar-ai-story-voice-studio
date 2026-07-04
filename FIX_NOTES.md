# V2 TTS Fix Notes

Fixed the Gemini TTS model name in `server.ts`:

- Removed the invalid model: `gemini-2.5-flash-tts`
- Added supported model: `gemini-3.1-flash-tts-preview`
- Added optional environment override: `GEMINI_TTS_MODEL`

After importing this ZIP into Google AI Studio, keep the Secret name as:

`GEMINI_API_KEY`

Then run Preview and test Generate Voice.
