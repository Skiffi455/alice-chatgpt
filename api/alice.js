export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;
  const session = body?.session;

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

  if (!session || !body?.request) {
    return res.status(400).json({ error: "Invalid Alice request" });
  }

  if (session.new) {
    return reply(
      "Привет! Я ИИ-помощник. Задай вопрос, и я постараюсь помочь.",
      false,
      { history: [] }
    );
  }

  const command = String(body.request.command || "").trim();
  if (!command) return reply("Я не расслышал вопрос. Повтори, пожалуйста.");

  const priorHistory = body.state?.session?.history;
  const history = Array.isArray(priorHistory)
    ? priorHistory
        .filter(item =>
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string"
        )
        .slice(-4)
    : [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY environment variable");
    return reply("Навык пока не настроен. Нужно добавить ключ Gemini на сервере.");
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

  try {
    const contents = [
      ...history.map(item => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content }]
      })),
      { role: "user", parts: [{ text: command }] }
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text:
                "Ты голосовой помощник в Яндекс Алисе. Отвечай по-русски, " +
                "естественно и коротко, обычно в 1–3 предложениях. " +
                "Не используй Markdown, таблицы и длинные списки."
            }]
          },
          contents,
          generationConfig: {
            maxOutputTokens: 120,
            temperature: 0.7
          }
        }),
        signal: AbortSignal.timeout(3900)
      }
    );

    if (!response.ok) {
      const details = await response.text();
      console.error("Gemini API error:", response.status, details.slice(0, 500));
      return reply("Не удалось получить ответ от ИИ. Попробуй ещё раз.");
    }

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim() || "";

    if (!answer) {
      console.error("Gemini returned no text:", JSON.stringify(data).slice(0, 500));
      return reply("Не получилось сформировать ответ. Попробуй задать вопрос иначе.");
    }

    const updatedHistory = [
      ...history,
      { role: "user", content: command },
      { role: "assistant", content: answer }
    ].slice(-4);

    return reply(answer, false, { history: updatedHistory });
  } catch (error) {
    console.error("Gemini request failed:", error?.message || error);
    return reply(
      "Сейчас не получается связаться с ИИ. Попробуй ещё раз чуть позже."
    );
  }
}
