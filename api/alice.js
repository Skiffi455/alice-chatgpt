export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;
  const session = body?.session;

  if (!session || !body?.request) {
    return res.status(400).json({ error: "Invalid Alice request" });
  }

  const reply = (text, endSession = false, sessionState) =>
    res.status(200).json({
      version: "1.0",
      session,
      ...(sessionState ? { session_state: sessionState } : {}),
      response: {
        text: String(text).slice(0, 1024),
        end_session: endSession
      }
    });

  if (body.session.new) {
    return reply(
      "Привет! Я ChatGPT. Задай вопрос, и я постараюсь помочь.",
      false,
      { history: [] }
    );
  }

  const command = String(body.request.command || "").trim();
  if (!command) {
    return reply("Я не расслышал вопрос. Повтори, пожалуйста.");
  }

  const priorHistory = body.state?.session?.history;
  const history = Array.isArray(priorHistory)
    ? priorHistory
        .filter((item) =>
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string"
        )
        .slice(-6)
    : [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Missing OPENAI_API_KEY environment variable");
    return reply("Навык пока не настроен. Нужно добавить ключ OpenAI на сервере.");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions:
          "Ты голосовой помощник в Яндекс Алисе. Отвечай на русском, " +
          "естественно и удобно для прослушивания. Обычно используй 2–5 " +
          "коротких предложений. Не используй Markdown, таблицы и длинные списки. " +
          "Если нужен подробный ответ, сначала дай краткий вывод.",
        input: [...history, { role: "user", content: command }],
        max_output_tokens: 220
      }),
      signal: AbortSignal.timeout(2800)
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("OpenAI API error:", response.status, details.slice(0, 500));
      return reply("Не удалось получить ответ от ChatGPT. Попробуй ещё раз.");
    }

    const data = await response.json();
    const answer = typeof data.output_text === "string"
      ? data.output_text.trim()
      : "";

    if (!answer) {
      return reply("Не получилось сформировать ответ. Попробуй задать вопрос иначе.");
    }

    const updatedHistory = [
      ...history,
      { role: "user", content: command },
      { role: "assistant", content: answer }
    ].slice(-6);

    return reply(answer, false, { history: updatedHistory });
  } catch (error) {
    console.error("OpenAI request failed:", error?.message || error);
    return reply(
      "Сейчас не получается связаться с ChatGPT. Попробуй ещё раз чуть позже."
    );
  }
}
