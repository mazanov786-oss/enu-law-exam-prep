import {
  ErrorRecord,
  ExamDeadlines,
  ExamQuestion,
  MasteryStatus,
  QuestionProgress,
  SubjectId,
  TicketHistoryItem,
  UserStudyState,
} from "@/types/exam";

const STORAGE_KEY = "enu_law_exam_prep_state_v1";

export function getDefaultState(): UserStudyState {
  // Default winter session dates in December 2026
  return {
    progress: {},
    errors: [],
    tickets: [],
    deadlines: {
      upDate: "2026-12-18",
      gpDate: "2026-12-22",
      targetDailyQuestions: 10,
      geminiApiKey: "",
    },
    streakDays: 1,
    lastStudyDate: new Date().toISOString().slice(0, 10),
    fontSize: "lg",
    syncKey: "timofey",
  };
}

export function loadStudyState(): UserStudyState {
  if (typeof window === "undefined") return getDefaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw) as Partial<UserStudyState>;
    const def = getDefaultState();
    return {
      progress: parsed.progress || {},
      errors: parsed.errors || [],
      tickets: parsed.tickets || [],
      deadlines: { ...def.deadlines, ...(parsed.deadlines || {}) },
      streakDays: parsed.streakDays || 1,
      lastStudyDate: parsed.lastStudyDate || def.lastStudyDate,
      fontSize: parsed.fontSize || "lg",
      syncKey: parsed.syncKey || "timofey",
      lastSyncedAt: parsed.lastSyncedAt,
    };
  } catch {
    return getDefaultState();
  }
}

export function saveStudyState(state: UserStudyState): void {
  if (typeof window === "undefined") return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    let streak = state.streakDays || 1;
    if (state.lastStudyDate && state.lastStudyDate !== today) {
      const prev = new Date(state.lastStudyDate);
      const curr = new Date(today);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 3600 * 24));
      if (diffDays === 1) streak += 1;
      else if (diffDays > 1) streak = 1;
    }
    const updated: UserStudyState = {
      ...state,
      streakDays: streak,
      lastStudyDate: today,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save study state:", e);
  }
}

export function getOrInitProgress(
  state: UserStudyState,
  questionId: string
): QuestionProgress {
  return (
    state.progress[questionId] || {
      questionId,
      status: "unseen",
      oralAttempts: 0,
      mcqCorrect: 0,
      mcqWrong: 0,
      clozeCorrect: 0,
      clozeWrong: 0,
      cardBox: 0,
    }
  );
}

export function computeMasteryStatus(p: QuestionProgress): MasteryStatus {
  const totalInteractions =
    p.oralAttempts + p.mcqCorrect + p.mcqWrong + p.clozeCorrect + p.clozeWrong + p.cardBox;
  if (totalInteractions === 0) return "unseen";

  const oralStrong = (p.oralScoreBest || 0) >= 80;
  const practiceStrong =
    p.mcqCorrect + p.clozeCorrect >= 3 &&
    p.mcqCorrect + p.clozeCorrect > (p.mcqWrong + p.clozeWrong) * 2;
  const cardStrong = p.cardBox >= 3;

  if (oralStrong || (practiceStrong && cardStrong) || (p.oralScoreBest || 0) >= 90) {
    return "mastered";
  }
  if ((p.oralScoreBest || 0) >= 60 || p.mcqCorrect + p.clozeCorrect >= 2 || p.cardBox >= 2) {
    return "review";
  }
  return "learning";
}

export function calculateSubjectReadiness(
  questions: ExamQuestion[],
  progress: Record<string, QuestionProgress>,
  subject?: SubjectId,
  moduleNum?: number
) {
  const filtered = questions.filter(
    (q) => (!subject || q.subject === subject) && (!moduleNum || q.module === moduleNum)
  );
  const total = filtered.length;
  if (total === 0) {
    return {
      total: 0,
      mastered: 0,
      review: 0,
      learning: 0,
      unseen: 0,
      readinessPercent: 0,
    };
  }

  let mastered = 0;
  let review = 0;
  let learning = 0;
  let unseen = 0;
  let weightedPoints = 0;

  for (const q of filtered) {
    const p = progress[q.id];
    const st = p ? p.status : "unseen";
    if (st === "mastered") {
      mastered++;
      weightedPoints += 1.0;
    } else if (st === "review") {
      review++;
      weightedPoints += 0.65;
    } else if (st === "learning") {
      learning++;
      weightedPoints += 0.3;
    } else {
      unseen++;
    }
  }

  const readinessPercent = Math.round((weightedPoints / total) * 100);
  return {
    total,
    mastered,
    review,
    learning,
    unseen,
    readinessPercent,
  };
}
