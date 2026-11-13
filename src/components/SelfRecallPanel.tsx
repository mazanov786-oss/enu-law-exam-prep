"use client";

import React, { useState, useCallback } from "react";
import {
  ErrorRecord,
  ExamQuestion,
} from "@/types/exam";
import {
  evaluateOralAnswer,
  getEnuGrade,
  OralEvaluationResult,
} from "@/lib/evaluator";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  Eye,
  EyeOff,
  ListChecks,
  Mic,
  MicOff,
  PenLine,
  RotateCcw,
  Scale,
  Sparkles,
} from "lucide-react";

interface AiFeedback {
  score?: number;
  letterGrade?: string;
  strengths?: string[];
  mistakes?: string[];
  missedArticles?: string[];
  examinerComment?: string;
  followupQuestion?: string;
}

interface SelfRecallPanelProps {
  question: ExamQuestion;
  isMastered: boolean;
  geminiApiKey?: string;
  onRecordQuestionScore: (questionId: string, score: number) => void;
  onToggleMastered: (questionId: string) => void;
  onAddError?: (err: Omit<ErrorRecord, "id" | "timestamp" | "resolved">) => void;
  onBackToLecture: () => void;
}

export default function SelfRecallPanel({
  question,
  isMastered,
  geminiApiKey,
  onRecordQuestionScore,
  onToggleMastered,
  onAddError,
  onBackToLecture,
}: SelfRecallPanelProps) {
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [evaluation, setEvaluation] = useState<OralEvaluationResult | null>(null);
  const [showPlanHint, setShowPlanHint] = useState<boolean>(false);
  const [showArticlesHint, setShowArticlesHint] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<AiFeedback | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>("");

  const handleVoiceChunk = useCallback((chunk: string) => {
    setUserAnswer((prev) => (prev.trim() ? `${prev.trim()} ${chunk}` : chunk));
  }, []);

  const {
    isListening,
    isSupported,
    interimText,
    error: speechError,
    toggleListening,
    stopListening,
  } = useSpeechRecognition(handleVoiceChunk);

  const handleCheckAnswer = () => {
    if (isListening) stopListening();
    const res = evaluateOralAnswer(userAnswer, question);
    setEvaluation(res);
    onRecordQuestionScore(question.id, res.score);

    if (res.score < 60 && onAddError && userAnswer.trim().length > 0) {
      onAddError({
        questionId: question.id,
        subject: question.subject,
        source: "ticket",
        prompt: `[Самопроверка в конспекте] Вопрос №${question.n}: ${question.text}`,
        userAnswer: userAnswer.trim(),
        expectedAnswer: question.answer,
        explanation: res.feedbackSummary,
        missedArticles: res.missedArticles,
        missedKeywords: res.missedKeywords,
      });
    }
  };

  const handleRunAiCheck = async () => {
    if (!geminiApiKey || !userAnswer.trim()) return;
    setAiLoading(true);
    setAiError("");
    try {
      const resp = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: question.text,
          referenceAnswer: question.answer,
          articles: question.articles,
          plan: question.plan,
          userAnswer: userAnswer.trim(),
          apiKey: geminiApiKey,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setAiError(data?.error || "Ошибка ответа Gemini API");
      } else {
        setAiResult(data);
        if (typeof data?.score === "number") {
          onRecordQuestionScore(question.id, data.score);
        }
      }
    } catch {
      setAiError("Не удалось подключиться к /api/evaluate");
    } finally {
      setAiLoading(false);
    }
  };

  const handleReset = () => {
    if (isListening) stopListening();
    setUserAnswer("");
    setEvaluation(null);
    setAiResult(null);
    setAiError("");
  };

  const selfOverrideScore = (score: number) => {
    onRecordQuestionScore(question.id, score);
    setEvaluation((prev) =>
      prev
        ? {
            ...prev,
            score,
            grade: getEnuGrade(score),
            feedbackSummary: `Сохранена ваша самооценка: ${score}% (${getEnuGrade(score).traditional}).`,
          }
        : prev
    );
  };

  return (
    <div className="space-y-4 rounded-2xl border border-indigo-500/35 bg-slate-950/85 p-4 sm:p-6 shadow-inner">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
            <PenLine className="h-4.5 w-4.5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-white">
              Самопроверка по памяти (Active Recall)
            </h4>
            <p className="text-xs text-slate-400">
              Эталонный ответ скрыт — попробуйте воспроизвести тезисы и статьи НПА самостоятельно
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToLecture}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Открыть конспект</span>
        </button>
      </div>

      {/* Optional Hints Row */}
      <div className="flex flex-wrap items-center gap-2">
        {question.plan.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPlanHint((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              showPlanHint
                ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white"
            }`}
          >
            <ListChecks className="h-3.5 w-3.5" />
            <span>{showPlanHint ? "Скрыть план-подсказку" : "Подсказать план ответа"}</span>
          </button>
        )}

        {question.articles.length > 0 && (
          <button
            type="button"
            onClick={() => setShowArticlesHint((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              showArticlesHint
                ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-300"
                : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white"
            }`}
          >
            {showArticlesHint ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span>{showArticlesHint ? "Скрыть статьи НПА" : "Подсказать статьи НПА"}</span>
          </button>
        )}

        <button
          type="button"
          onClick={toggleListening}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            isListening
              ? "bg-rose-600 text-white animate-pulse"
              : "border border-slate-800 bg-slate-900 text-slate-300 hover:border-indigo-500/50 hover:text-white"
          }`}
        >
          {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          <span>
            {isListening
              ? "Остановить запись"
              : isSupported
              ? "Надиктовать голосом"
              : "Микрофон (Chrome/Edge)"}
          </span>
        </button>
      </div>

      {showPlanHint && question.plan.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 space-y-1.5">
          <div className="text-xs font-black uppercase tracking-wider text-amber-300">
            Опорный план:
          </div>
          <ol className="list-decimal list-inside space-y-1 read-sm text-slate-200">
            {question.plan.map((p, i) => (
              <li key={i}>{p.replace(/^\d+\.\s*/, "")}</li>
            ))}
          </ol>
        </div>
      )}

      {showArticlesHint && question.articles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-3">
          {question.articles.map((art, i) => (
            <span
              key={i}
              className="rounded-md border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-0.5 text-xs font-bold text-indigo-300"
            >
              {art}
            </span>
          ))}
        </div>
      )}

      {speechError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300">
          {speechError}
        </div>
      )}

      {/* Answer Input Area */}
      <div className="space-y-2">
        <textarea
          rows={6}
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Напишите своими словами по памяти: определение понятия, ключевые признаки, классификацию, точные статьи УК/ГК РК и правовые последствия..."
          className="w-full rounded-xl border border-slate-700 bg-slate-900/90 p-4 read-body text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        {interimText && (
          <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/60 px-3 py-1.5 text-xs italic text-indigo-200">
            Распознается: «{interimText}...»
          </div>
        )}
      </div>

      {/* Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!userAnswer.trim()}
            onClick={handleCheckAnswer}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed transition shadow-md"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Проверить ответ</span>
          </button>

          {geminiApiKey && (
            <button
              type="button"
              disabled={aiLoading || !userAnswer.trim()}
              onClick={handleRunAiCheck}
              className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/40 bg-purple-500/15 px-4 py-2.5 text-sm font-bold text-purple-200 hover:bg-purple-500/25 disabled:opacity-45 transition"
            >
              <Brain className="h-4 w-4" />
              <span>{aiLoading ? "ИИ проверяет..." : "ИИ-проверка (Gemini)"}</span>
            </button>
          )}
        </div>

        {(userAnswer || evaluation) && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Написать заново</span>
          </button>
        )}
      </div>

      {aiError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-300">
          {aiError}
        </div>
      )}

      {/* Evaluation & Side-by-Side Comparison */}
      {evaluation && (
        <div className="space-y-4 pt-3 border-t border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Результат самопроверки
              </div>
              <div className="text-xl font-black text-white">
                {evaluation.grade.traditional} • {evaluation.score}%
              </div>
              <p className="read-sm text-slate-300">{evaluation.feedbackSummary}</p>
            </div>
            <div className={`rounded-xl border px-4 py-2 text-2xl font-black ${evaluation.grade.color}`}>
              {evaluation.grade.letter}
            </div>
          </div>

          {/* Articles & Keywords Coverage */}
          <div className="grid gap-3 md:grid-cols-2">
            {question.articles.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5 text-indigo-400" />
                  <span>
                    Статьи НПА ({evaluation.matchedArticles.length}/{question.articles.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {question.articles.map((art, i) => {
                    const hit = evaluation.matchedArticles.includes(art);
                    return (
                      <span
                        key={i}
                        className={`rounded-md border px-2 py-0.5 text-xs font-bold ${
                          hit
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                            : "border-rose-500/40 bg-rose-500/15 text-rose-300"
                        }`}
                      >
                        {hit ? "✓ " : "✗ "}
                        {art}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {question.keywords.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>
                    Ключевые термины ({evaluation.matchedKeywords.length}/{question.keywords.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {question.keywords.map((kw, i) => {
                    const hit = evaluation.matchedKeywords.includes(kw);
                    return (
                      <span
                        key={i}
                        className={`rounded-md border px-2 py-0.5 text-xs ${
                          hit
                            ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300 font-semibold"
                            : "border-slate-700 bg-slate-800 text-slate-400"
                        }`}
                      >
                        {hit ? "✓ " : "• "}
                        {kw}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Optional AI Examiner Feedback */}
          {aiResult && (
            <div className="rounded-xl border border-purple-500/35 bg-purple-950/25 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-purple-300">
                  Комментарий ИИ-экзаменатора (Gemini)
                </span>
                {aiResult.letterGrade && (
                  <span className="rounded-md bg-purple-500/20 px-2.5 py-0.5 text-xs font-black text-purple-200">
                    {aiResult.letterGrade} ({aiResult.score}%)
                  </span>
                )}
              </div>
              {aiResult.examinerComment && (
                <p className="read-sm text-slate-200">{aiResult.examinerComment}</p>
              )}
              {aiResult.mistakes && aiResult.mistakes.length > 0 && (
                <div className="text-xs text-rose-300">
                  <strong>Что уточнить/исправить:</strong> {aiResult.mistakes.join("; ")}
                </div>
              )}
              {aiResult.followupQuestion && (
                <div className="text-xs text-amber-300">
                  <strong>Возможный доп. вопрос преподавателя:</strong> {aiResult.followupQuestion}
                </div>
              )}
            </div>
          )}

          {/* Self-Correction + Mark Mastered */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-400 mr-1">
                Скорректировать оценку:
              </span>
              <button
                type="button"
                onClick={() => selfOverrideScore(95)}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20"
              >
                Отлично (A)
              </button>
              <button
                type="button"
                onClick={() => selfOverrideScore(80)}
                className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-300 hover:bg-sky-500/20"
              >
                Хорошо (B)
              </button>
              <button
                type="button"
                onClick={() => selfOverrideScore(55)}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
              >
                Слабо (D)
              </button>
            </div>

            {!isMastered && (
              <button
                type="button"
                onClick={() => onToggleMastered(question.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Отметить выученным</span>
              </button>
            )}
          </div>

          {/* Side-by-Side Comparison: User vs Reference */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
              <div className="text-xs font-black uppercase tracking-wider text-indigo-300">
                Ваш ответ:
              </div>
              <div className="read-body text-slate-200 whitespace-pre-line">
                {userAnswer}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4 space-y-2">
              <div className="text-xs font-black uppercase tracking-wider text-emerald-300">
                Эталонный конспект (для сравнения):
              </div>
              <div className="read-body text-slate-100 whitespace-pre-line">
                {question.answer}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
