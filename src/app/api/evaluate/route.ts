import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { questionText, referenceAnswer, articles, plan, userAnswer, apiKey } = body;

    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "API ключ Gemini не указан. Используется встроенный локальный анализатор ответа." },
        { status: 400 }
      );
    }

    const systemPrompt = `Ты — строгий, но справедливый профессор юридического факультета ЕНУ им. Л.Н. Гумилёва (Астана, Казахстан), принимающий устный экзамен у студента 2 курса по праву Республики Казахстан (УК РК 2014 г. / ГК РК Общая часть).
Оцени устный ответ студента по сравнению с эталоном и планом ответа.
Верни ответ СТРОГО в формате JSON без markdown-обертки:
{
  "score": число от 0 до 100,
  "letterGrade": "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "D" | "F",
  "strengths": ["что студент назвал правильно"],
  "mistakes": ["какие юридические неточности, ошибки или пробелы допущены"],
  "missedArticles": ["какие статьи УК/ГК РК нужно было обязательно упомянуть"],
  "examinerComment": "краткий профессиональный вердикт экзаменатора (2-4 предложения)",
  "followupQuestion": "1 точечный дополнительный вопрос на засыпку именно по слабой части ответа студента"
}`;

    const userPrompt = `Вопрос билета: ${questionText}
Обязательные статьи НПА РК: ${(articles || []).join(", ")}
План ответа: ${(plan || []).join(" | ")}
Эталонный ответ: ${referenceAnswer}

Ответ студента (транскрипция голоса/текст):
"${userAnswer}"`;

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
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Ошибка Gemini API (${response.status}): ${errText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(rawText);
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Ошибка при проверке ответа ИИ-экзаменатором" },
      { status: 500 }
    );
  }
}
