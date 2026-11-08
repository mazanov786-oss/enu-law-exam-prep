import { EnuGradeInfo, ExamQuestion, QuestionProgress, SubjectId } from "@/types/exam";

export function getEnuGrade(scorePercent: number): EnuGradeInfo {
  const s = Math.round(scorePercent);
  if (s >= 95) {
    return {
      letter: "A",
      gpa: 4.0,
      percentRange: "95–100%",
      traditional: "Отлично",
      color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
      description:
        "Глубокое и исчерпывающее знание норм УК/ГК РК, точные ссылки на статьи и НП ВС РК, юридически грамотная речь без ошибок.",
    };
  }
  if (s >= 90) {
    return {
      letter: "A-",
      gpa: 3.67,
      percentRange: "90–94%",
      traditional: "Отлично",
      color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
      description:
        "Полное раскрытие всех вопросов билета с верной квалификацией и ссылками на статьи НПА РК, незначительные неточности в деталях.",
    };
  }
  if (s >= 85) {
    return {
      letter: "B+",
      gpa: 3.33,
      percentRange: "85–89%",
      traditional: "Хорошо",
      color: "text-sky-400 border-sky-500/40 bg-sky-500/10",
      description:
        "Твердое знание программного материала и базовых статей кодекса, логичный ответ, но упущены 1–2 второстепенных признака.",
    };
  }
  if (s >= 80) {
    return {
      letter: "B",
      gpa: 3.0,
      percentRange: "80–84%",
      traditional: "Хорошо",
      color: "text-sky-400 border-sky-500/40 bg-sky-500/10",
      description:
        "Основное содержание вопроса раскрыто верно, приведены ключевые нормы закона, есть отдельные пробелы в аргументации.",
    };
  }
  if (s >= 75) {
    return {
      letter: "B-",
      gpa: 2.67,
      percentRange: "75–79%",
      traditional: "Хорошо",
      color: "text-sky-400 border-sky-500/40 bg-sky-500/10",
      description:
        "Правильное понимание сущности института, но не все номера статей или классификации названы точно.",
    };
  }
  if (s >= 70) {
    return {
      letter: "C+",
      gpa: 2.33,
      percentRange: "70–74%",
      traditional: "Удовлетворительно",
      color: "text-amber-400 border-amber-500/40 bg-amber-500/10",
      description:
        "Ответ неполный: названы общие определения, но пропущены важные статьи кодекса или специальные условия.",
    };
  }
  if (s >= 65) {
    return {
      letter: "C",
      gpa: 2.0,
      percentRange: "65–69%",
      traditional: "Удовлетворительно",
      color: "text-amber-400 border-amber-500/40 bg-amber-500/10",
      description:
        "Поверхностное изложение материала, затруднения с номерами статей и примерами из практики.",
    };
  }
  if (s >= 50) {
    return {
      letter: s >= 60 ? "C-" : s >= 55 ? "D+" : "D",
      gpa: s >= 60 ? 1.67 : s >= 55 ? 1.33 : 1.0,
      percentRange: "50–64%",
      traditional: "Удовлетворительно (порог)",
      color: "text-orange-400 border-orange-500/40 bg-orange-500/10",
      description:
        "Пороговый уровень: фрагментарные знания, серьезные пробелы в знании норм УК/ГК РК. Требуется повторение темы.",
    };
  }
  return {
    letter: s >= 25 ? "FX" : "F",
    gpa: 0,
    percentRange: "0–49%",
    traditional: "Неудовлетворительно",
    color: "text-rose-400 border-rose-500/40 bg-rose-500/10",
    description:
      "Вопрос не раскрыт или допущены грубые юридические ошибки. Необходима детальная проработка конспекта.",
  };
}

const SPOKEN_NUMBERS: Record<string, string> = {
  перв: "1",
  один: "1",
  одной: "1",
  втор: "2",
  дв: "2",
  трет: "3",
  тр: "3",
  четверт: "4",
  четыр: "4",
  пят: "5",
  шест: "6",
  седьм: "7",
  сем: "7",
  восьм: "8",
  восем: "8",
  девят: "9",
  десят: "10",
  одиннадцат: "11",
  двенадцат: "12",
  тринадцат: "13",
  четырнадцат: "14",
  пятнадцат: "15",
  шестнадцат: "16",
  семнадцат: "17",
  восемнадцат: "18",
  девятнадцат: "19",
  двадцат: "20",
  тридцат: "30",
  сорок: "40",
  пятьдесят: "50",
  шестьдесят: "60",
  семьдесят: "70",
  восемьдесят: "80",
  девяност: "90",
  ст: "100",
};

export function normalizeRussianText(input: string): string {
  return input
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'`(),.;:!?—–\-\/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stemRussianWord(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, "е");
  if (w.length <= 4) return w;
  return w.replace(
    /(ыми|ими|ого|его|ому|ему|ами|ями|иях|иям|ией|ость|ости|остью|ение|ения|ению|ением|ание|ания|анием|ать|ять|ить|ует|ют|ая|яя|ое|ее|ые|ие|ой|ей|ий|ый|ом|ем|ам|ям|ах|ях|ую|юю|ов|ев|ей|ью|ия|ии|ию|а|я|о|е|ы|и|у|ю)$/,
    ""
  );
}

/**
 * Extracts all numbers from a string (e.g. "ст. 32 УК РК" -> ["32"])
 */
function extractNumbers(str: string): string[] {
  const matches = str.match(/\d+(?:-\d+)?/g);
  return matches ? matches : [];
}

/**
 * Checks if a user's oral/written response matches a target keyword or statutory article.
 */
export function matchesKeywordOrArticle(userText: string, target: string): boolean {
  const normUser = normalizeRussianText(userText);
  const normTarget = normalizeRussianText(target);
  if (!normUser || !normTarget) return false;

  // Direct substring match
  if (normUser.includes(normTarget)) return true;

  // If target is an article reference like "ст. 32 УК РК" or "ст. 188 ГК РК"
  const targetNums = extractNumbers(normTarget);
  const isArticleTarget =
    normTarget.startsWith("ст ") ||
    normTarget.includes(" ук") ||
    normTarget.includes(" гк") ||
    normTarget.includes(" коап") ||
    normTarget.includes(" упк");

  if (isArticleTarget && targetNums.length > 0) {
    // Check if the main article number appears in user's text
    const mainNum = targetNums[0];
    const numRegex = new RegExp(`(^|\\s|ст)${mainNum}(\\s|$)`, "i");
    if (numRegex.test(normUser)) return true;
  }

  // Tokenize target into meaningful words (skip stop words like "ук", "гк", "рк", "ст", "и", "в")
  const stopWords = new Set(["ук", "гк", "рк", "ст", "статья", "статьи", "или", "для", "при", "как", "что", "это", "под", "над", "без"]);
  const targetTokens = normTarget
    .split(" ")
    .filter((t) => t.length >= 2 && !stopWords.has(t));

  if (targetTokens.length === 0) return false;

  const userTokens = normUser.split(" ");
  const userStems = userTokens.map(stemRussianWord);

  let matchedTokens = 0;
  for (const tToken of targetTokens) {
    if (/^\d+$/.test(tToken)) {
      if (userTokens.includes(tToken)) {
        matchedTokens++;
      } else {
        // Check spoken number fallback
        const foundSpoken = Object.entries(SPOKEN_NUMBERS).some(
          ([stem, num]) => num === tToken && normUser.includes(stem)
        );
        if (foundSpoken) matchedTokens++;
      }
      continue;
    }

    const tStem = stemRussianWord(tToken);
    const hit = userTokens.some(
      (u, idx) =>
        u.includes(tStem) ||
        tStem.includes(userStems[idx]) && userStems[idx].length >= 4 ||
        userStems[idx] === tStem
    );
    if (hit) matchedTokens++;
  }

  return matchedTokens / targetTokens.length >= 0.65;
}

export interface OralEvaluationResult {
  score: number;
  grade: EnuGradeInfo;
  matchedKeywords: string[];
  missedKeywords: string[];
  matchedArticles: string[];
  missedArticles: string[];
  wordCount: number;
  feedbackSummary: string;
}

export function evaluateOralAnswer(
  userText: string,
  question: ExamQuestion
): OralEvaluationResult {
  const words = userText
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const wordCount = words.length;

  const matchedKeywords: string[] = [];
  const missedKeywords: string[] = [];

  for (const kw of question.keywords) {
    if (matchesKeywordOrArticle(userText, kw)) {
      matchedKeywords.push(kw);
    } else {
      missedKeywords.push(kw);
    }
  }

  const matchedArticles: string[] = [];
  const missedArticles: string[] = [];

  for (const art of question.articles) {
    if (matchesKeywordOrArticle(userText, art)) {
      matchedArticles.push(art);
    } else {
      missedArticles.push(art);
    }
  }

  const kwRatio =
    question.keywords.length > 0
      ? matchedKeywords.length / question.keywords.length
      : 1;
  const artRatio =
    question.articles.length > 0
      ? matchedArticles.length / question.articles.length
      : 1;

  // Length factor: a solid oral answer should be at least ~60-90 words
  const lengthFactor = Math.min(1, wordCount / 75);

  // Weighted score: 55% keywords/concepts, 25% statutory articles, 20% completeness/length
  let rawScore = Math.round((kwRatio * 0.55 + artRatio * 0.25 + lengthFactor * 0.2) * 100);

  if (wordCount < 10) {
    rawScore = Math.min(rawScore, 20);
  } else if (kwRatio >= 0.75 && artRatio >= 0.5 && wordCount >= 55) {
    // Boost strong legal answers so minor synonym differences don't unfairly penalize
    rawScore = Math.min(100, rawScore + 12);
  }

  const grade = getEnuGrade(rawScore);

  let feedbackSummary = "";
  if (rawScore >= 85) {
    feedbackSummary =
      "Отличный ответ! Вы уверенно назвали ключевые юридические признаки и сослались на нормы законодательства РК.";
  } else if (rawScore >= 65) {
    feedbackSummary =
      "Хорошая база, но для оценки «Отлично» (A/A-) важно точнее назвать статьи кодекса и раскрыть пропущенные термины.";
  } else {
    feedbackSummary =
      "Ответ пока неполный. Обратите внимание на пропущенные ключевые понятия, статьи кодекса и ловушки экзаменатора ниже.";
  }

  return {
    score: rawScore,
    grade,
    matchedKeywords,
    missedKeywords,
    matchedArticles,
    missedArticles,
    wordCount,
    feedbackSummary,
  };
}

export interface ParsedClozeSegment {
  type: "text" | "blank";
  content: string;
  options?: string[];
  blankIndex?: number;
}

export function parseClozeText(clozeText: string): ParsedClozeSegment[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const segments: ParsedClozeSegment[] = [];
  let lastIndex = 0;
  let blankCounter = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(clozeText)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: clozeText.slice(lastIndex, match.index),
      });
    }
    const rawOptions = match[1]
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    segments.push({
      type: "blank",
      content: rawOptions[0] || "",
      options: rawOptions,
      blankIndex: blankCounter++,
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < clozeText.length) {
    segments.push({
      type: "text",
      content: clozeText.slice(lastIndex),
    });
  }

  return segments;
}

export function checkClozeBlank(userInput: string, acceptedOptions: string[]): boolean {
  const cleanUser = normalizeRussianText(userInput);
  if (!cleanUser) return false;

  for (const opt of acceptedOptions) {
    const cleanOpt = normalizeRussianText(opt);
    if (cleanUser === cleanOpt) return true;

    // Check number equivalence (e.g., "14 лет" vs "14" or "четырнадцати")
    const optNums = extractNumbers(cleanOpt);
    const userNums = extractNumbers(cleanUser);
    if (optNums.length > 0 && optNums[0] === userNums[0]) {
      return true;
    }

    // Stem comparison for inflected Russian legal terms
    const userStems = cleanUser.split(" ").map(stemRussianWord).join(" ");
    const optStems = cleanOpt.split(" ").map(stemRussianWord).join(" ");
    if (userStems === optStems && userStems.length >= 3) {
      return true;
    }

    if (matchesKeywordOrArticle(cleanUser, cleanOpt) && cleanUser.length >= 3) {
      return true;
    }
  }
  return false;
}

/**
 * Generates an official 3-question oral exam ticket:
 * - Question 1: First half of Module 1 (foundational concepts / subjects / criminal law)
 * - Question 2: Second half of Module 1 (offense elements / transactions / representation)
 * - Question 3: Module 2 (punishment & release / property, obligations & contracts)
 */
export function generateExamTicket(
  allQuestions: ExamQuestion[],
  subject: SubjectId,
  progressMap: Record<string, QuestionProgress>,
  mode: "smart" | "random" | "weak" = "smart"
): [ExamQuestion, ExamQuestion, ExamQuestion] {
  const subjQuestions = allQuestions
    .filter((q) => q.subject === subject)
    .sort((a, b) => a.module - b.module || a.n - b.n);

  const mod1 = subjQuestions.filter((q) => q.module === 1);
  const mod2 = subjQuestions.filter((q) => q.module === 2);

  const midMod1 = Math.ceil(mod1.length / 2);
  const bucket1 = mod1.slice(0, midMod1);
  const bucket2 = mod1.slice(midMod1);
  const bucket3 = mod2.length > 0 ? mod2 : subjQuestions.slice(Math.floor(subjQuestions.length * 0.66));

  const pickFromBucket = (bucket: ExamQuestion[], excludeIds: Set<string>): ExamQuestion => {
    const candidates = bucket.filter((q) => !excludeIds.has(q.id));
    const pool = candidates.length > 0 ? candidates : subjQuestions.filter((q) => !excludeIds.has(q.id));

    if (mode === "random") {
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // Weight questions by weakness / unseen status
    const weighted = pool.map((q) => {
      const p = progressMap[q.id];
      let weight = 5;
      if (!p || p.status === "unseen") weight = 10;
      else if (p.status === "learning") weight = 14;
      else if (p.status === "review") weight = 7;
      else if (p.status === "mastered") weight = mode === "weak" ? 1 : 2;

      if (p && (p.mcqWrong > p.mcqCorrect || p.clozeWrong > p.clozeCorrect)) {
        weight += 8;
      }
      return { q, weight: weight + Math.random() * 4 };
    });

    weighted.sort((a, b) => b.weight - a.weight);
    const topSlice = weighted.slice(0, Math.min(6, weighted.length));
    return topSlice[Math.floor(Math.random() * topSlice.length)].q;
  };

  const used = new Set<string>();
  const q1 = pickFromBucket(bucket1, used);
  used.add(q1.id);
  const q2 = pickFromBucket(bucket2, used);
  used.add(q2.id);
  const q3 = pickFromBucket(bucket3, used);

  return [q1, q2, q3];
}
