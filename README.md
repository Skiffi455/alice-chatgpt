# ChatGPT for Yandex Alice

Serverless webhook for a Yandex Dialogs skill, hosted on Vercel and powered by the OpenAI Responses API.

## Deploy

1. Import this repository into Vercel.
2. Add `OPENAI_API_KEY` as an encrypted environment variable for Production and Preview.
3. Optionally set `OPENAI_MODEL` (default: `gpt-4.1-mini`).
4. Redeploy after setting environment variables.
5. Configure the Yandex Dialogs webhook URL as `https://YOUR-VERCEL-DOMAIN/api/alice`.

Never commit API keys to Git.

## Notes

- Yandex Alice has a tight webhook response deadline; model latency can cause timeouts.
- Session history is intentionally short and stored in Alice session state; it is not long-term memory.
- This endpoint is intended to be called by the skill backend. Add request verification/rate limiting before public production use.
