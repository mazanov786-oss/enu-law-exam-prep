import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("audio") as File | null;
    const clientApiKey = (formData.get("apiKey") as string | null)?.trim();

    const key = clientApiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json(
        {
          error:
            "Для резервной расшифровки аудио нужен Gemini API ключ (укажите его на Главной в разделе «Настройки»). Либо используйте Google Chrome / Microsoft Edge для встроенного голосового ввода.",
        },
        { status: 400 }
      );
    }

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "Аудиофайл пуст. Проверьте, работает ли микрофон." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = (file.type || "audio/webm").split(";")[0];

    const prompt =
      "Транскрибируй эту голосовую запись устного ответа студента-юриста на русском языке максимально точно. " +
      "Сохраняй юридические термины Казахстана (УК РК, ГК РК, КоАП РК, УПК РК, ВС РК, номера статей в формате 'ст. 123'). " +
      "Верни ТОЛЬКО чистый расшифрованный текст без пояснений и кавычек. Если речи нет, верни пустую строку.";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        key
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64Audio,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Ошибка Gemini Audio API (${response.status}): ${errText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    return NextResponse.json({ text });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Ошибка при расшифровке голосовой записи" },
      { status: 500 }
    );
  }
}
