export type SubjectId = "up" | "gp";

export type CoverageStatus = "full" | "partial" | "none";

export interface FlashcardItem {
  front: string;
  back: string;
}

export interface McqItem {
  q: string;
  options: string[];
  correct: number;
  explain: string;
  isHard?: boolean;
}

export interface ClozeItem {
  text: string;
  hint: string;
}

export interface CaseStudy {
  caseTitle: string;
  facts: string;
  question: string;
  solution: string;
  articles: string[];
}

export interface ExamQuestion {
  id: string;
  subject: SubjectId;
  module: number;
  n: number;
  text: string;
  notes: string[];
  coverage: CoverageStatus;
  gaps: string;
  articles: string[];
  plan: string[];
  answer: string;
  keywords: string[];
  cards: FlashcardItem[];
  mcq: McqItem[];
  cloze: ClozeItem[];
  traps: string[];
  followups: string[];
  caseStudy?: CaseStudy;
}

export interface SubjectMeta {
  title: string;
  code: string;
  teacher: string;
  modules: Record<string, string>;
}

export interface ExamDatabase {
  subjects: Record<SubjectId, SubjectMeta>;
  questions: ExamQuestion[];
}

export type MasteryStatus = "unseen" | "learning" | "review" | "mastered";

export interface QuestionProgress {
  questionId: string;
  status: MasteryStatus;
  lastPracticed?: string; // ISO date
  oralScoreBest?: number; // 0..100
  oralAttempts: number;
  mcqCorrect: number;
  mcqWrong: number;
  clozeCorrect: number;
  clozeWrong: number;
  cardBox: number; // 0..4 Leitner box
  nextReviewAt?: string; // ISO date
}

export type ErrorSource = "ticket" | "mcq" | "cloze" | "flashcard";

export interface ErrorRecord {
  id: string;
  questionId: string;
  subject: SubjectId;
  source: ErrorSource;
  timestamp: string;
  prompt: string;
  userAnswer: string;
  expectedAnswer: string;
  explanation: string;
  missedArticles: string[];
  missedKeywords: string[];
  resolved: boolean;
}

export interface TicketHistoryItem {
  id: string;
  subject: SubjectId;
  timestamp: string;
  questionIds: [string, string, string];
  scores: [number, number, number];
  averageScore: number;
  enuGrade: string;
  durationSec: number;
}

export interface ExamDeadlines {
  upDate: string; // YYYY-MM-DD
  gpDate: string; // YYYY-MM-DD
  targetDailyQuestions: number;
  geminiApiKey?: string;
}

export interface UserStudyState {
  progress: Record<string, QuestionProgress>;
  errors: ErrorRecord[];
  tickets: TicketHistoryItem[];
  deadlines: ExamDeadlines;
  streakDays: number;
  lastStudyDate?: string;
  fontSize?: "md" | "lg" | "xl";
  syncKey?: string;
  lastSyncedAt?: string;
}

export interface EnuGradeInfo {
  letter: string;
  gpa: number;
  percentRange: string;
  traditional: string;
  color: string;
  description: string;
}
