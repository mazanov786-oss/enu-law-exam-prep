import fs from "fs";
import path from "path";

const rootDir = process.cwd();
const questionsFile = path.join(rootDir, "data", "questions.json");
const contentDir = path.join(rootDir, "data", "content");
const outDir = path.join(rootDir, "src", "data");
const outFile = path.join(outDir, "exam-data.json");

const master = JSON.parse(fs.readFileSync(questionsFile, "utf8"));
const contentMap = new Map();

if (fs.existsSync(contentDir)) {
  const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    try {
      const arr = JSON.parse(fs.readFileSync(path.join(contentDir, f), "utf8"));
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (item && item.id) {
            contentMap.set(item.id, item);
          }
        }
      }
    } catch (e) {
      console.error(`Error parsing ${f}:`, e.message);
    }
  }
}

const mergedQuestions = master.questions.map((q) => {
  const rich = contentMap.get(q.id);
  if (!rich) {
    return {
      ...q,
      notes: [q.subject === "up" ? "Уголовное право (Общая часть)" : "Гражданское право (Общая часть)"],
      coverage: "full",
      gaps: "",
      articles: [q.subject === "up" ? "УК РК" : "ГК РК"],
      plan: ["1. Понятие и общая характеристика", "2. Нормативное регулирование в РК", "3. Признаки и виды", "4. Правоприменительная практика"],
      answer: `Вопрос «${q.text}» регулируется нормами ${q.subject === "up" ? "Уголовного кодекса РК" : "Гражданского кодекса РК (Общая часть)"}.`,
      keywords: q.text.replace(/[.,()]/g, "").split(" ").filter((w) => w.length > 4),
      cards: [{ front: q.text, back: `См. конспект по теме «${q.text}»` }],
      mcq: [
        {
          q: `Какой кодифицированный акт РК регулирует вопрос: «${q.text}»?`,
          options: [
            q.subject === "up" ? "Уголовный кодекс РК 2014 г." : "Гражданский кодекс РК (Общая часть)",
            "Трудовой кодекс РК",
            "Экологический кодекс РК",
            "Кодекс РК о браке и семье"
          ],
          correct: 0,
          explain: "Базовый кодифицированный источник данной отрасли права РК."
        }
      ],
      cloze: [
        {
          text: `Институт «${q.text}» закреплен в нормах {{${q.subject === "up" ? "УК РК" : "ГК РК"}}}.`,
          hint: q.subject === "up" ? "УК РК" : "ГК РК"
        }
      ],
      traps: ["Обращайте внимание на точные сроки и статьи кодекса РК."],
      followups: [`Каковы основные правовые последствия по вопросу «${q.text}»?`]
    };
  }
  return {
    ...q,
    notes: Array.isArray(rich.notes) ? rich.notes : [],
    coverage: rich.coverage || "full",
    gaps: rich.gaps || "",
    articles: Array.isArray(rich.articles) ? rich.articles : [],
    plan: Array.isArray(rich.plan) ? rich.plan : [],
    answer: rich.answer || "",
    keywords: Array.isArray(rich.keywords) ? rich.keywords : [],
    cards: Array.isArray(rich.cards) ? rich.cards : [],
    mcq: Array.isArray(rich.mcq) ? rich.mcq : [],
    cloze: Array.isArray(rich.cloze) ? rich.cloze : [],
    traps: Array.isArray(rich.traps) ? rich.traps : [],
    followups: Array.isArray(rich.followups) ? rich.followups : [],
  };
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  outFile,
  JSON.stringify(
    {
      subjects: master.subjects,
      questions: mergedQuestions,
    },
    null,
    2
  ),
  "utf8"
);

console.log(
  `Merged ${mergedQuestions.length} questions (${contentMap.size} enriched from data/content/*.json) -> ${outFile}`
);
