"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ErrorRecord,
  ExamDatabase,
  ExamQuestion,
  McqItem,
  SubjectId,
  UserStudyState,
} from "@/types/exam";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Filter,
  Flame,
  BookOpen,
  AlertTriangle,
} from "lucide-react";

interface FlattenedMcq {
  id: string;
  question: ExamQuestion;
  item: McqItem;
  indexInQuestion: number;
}

interface TestModeViewProps {
  db: ExamDatabase;
  state: UserStudyState;
  activeSubject: SubjectId;
  onSelectSubject: (s: SubjectId) => void;
  onRecordMcq: (questionId: string, correct: boolean) => void;
  onAddError: (err: Omit<ErrorRecord, "id" | "timestamp" | "resolved">) => void;
}

export default function TestModeView({
  db,
  state,
  activeSubject,
  onSelectSubject,
  onRecordMcq,
  onAddError,
}: TestModeViewProps) {
  const [moduleFilter, setModuleFilter] = useState<number | "all">("all");
  const [onlyWeak, setOnlyWeak] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [sessionCorrect, setSessionCorrect] = useState<number>(0);
  const [sessionTotal, setSessionTotal] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [seed, setSeed] = useState<number>(1);

  const pool = useMemo(() => {
    const errorQuestionIds = new Set(
      state.errors.filter((e) => !e.resolved).map((e) => e.questionId)
    );

    const filteredQuestions = db.questions.filter((q) => {
      if (q.subject !== activeSubject) return false;
      if (moduleFilter !== "all" && q.module !== moduleFilter) return false;
      if (onlyWeak) {
        const p = state.progress[q.id];
        const isWeak =
          errorQuestionIds.has(q.id) ||
          !p ||
          p.status === "unseen" ||
          p.status === "learning" ||
          p.mcqWrong > 0;
        if (!isWeak) return false;
      }
      return true;
    });

    const list: FlattenedMcq[] = [];
    for (const q of filteredQuestions) {
      q.mcq.forEach((item, idx) => {
        list.push({
          id: `${q.id}-mcq-${idx}`,
          question: q,
          item,
          indexInQuestion: idx,
        });
      });
    }

    // Deterministic shuffle based on seed
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(
        Math.abs(Math.sin(seed * 999 + i * 37)) * (i + 1)
      );
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [db.questions, activeSubject, moduleFilter, onlyWeak, seed, state.errors, state.progress]);

  useEffect(() => {
    setCurrentIndex(0);
    setSelectedOption(null);
  }, [activeSubject, moduleFilter, onlyWeak, seed]);

  if (pool.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center space-y-3">
        <p className="text-base font-bold text-white">
          Нет тестовых вопросов по выбранному фильтру
        </p>
        <button
          onClick={() => {
            setOnlyWeak(false);
            setModuleFilter("all");
          }}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
        >
          Показать все вопросы
        </button>
      </div>
    );
  }

  const current = pool[currentIndex % pool.length];
  const isAnswered = selectedOption !== null;
  const isCorrect = selectedOption === current.item.correct;

  const handleSelectOption = (idx: number) => {
    if (isAnswered) return;
    setSelectedOption(idx);
    const ok = idx === current.item.correct;
    setSessionTotal((t) => t + 1);
    onRecordMcq(current.question.id, ok);

    if (ok) {
      setSessionCorrect((c) => c + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
      onAddError({
        questionId: current.question.id,
        subject: current.question.subject,
        source: "mcq",
        prompt: current.item.q,
        userAnswer: current.item.options[idx] || "",
        expectedAnswer: current.item.options[current.item.correct] || "",
        explanation: current.item.explain,
        missedArticles: current.question.articles,
        missedKeywords: current.question.keywords.slice(0, 4),
      });
    }
  };

  const handleNext = () => {
    setSelectedOption(null);
    setCurrentIndex((i) => (i + 1) % pool.length);
  };

  return (
    <div className="space-y-6">
      {/* Filter & Stats Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
            <Filter className="h-3.5 w-3.5" />
            <span>Тестовый тренажер с проверкой статей УК/ГК РК и ловушек</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-white">
            {db.subjects[activeSubject].title} — Тестирование ({pool.length} вопр.)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Subject Switcher */}
          <div className="inline-flex rounded-xl border border-slate-700 bg-slate-950 p-1">
            <button
              onClick={() => onSelectSubject("up")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeSubject === "up"
                  ? "bg-rose-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              УП РК
            </button>
            <button
              onClick={() => onSelectSubject("gp")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeSubject === "gp"
                  ? "bg-sky-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ГП РК
            </button>
          </div>

          {/* Module Selector */}
          <select
            value={String(moduleFilter)}
            onChange={(e) =>
              setModuleFilter(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
          >
            <option value="all">Все модули (РК-1 + РК-2)</option>
            <option value="1">Только Модуль 1 (РК-1)</option>
            <option value="2">Только Модуль 2 (РК-2)</option>
          </select>

          <button
            onClick={() => setOnlyWeak(!onlyWeak)}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              onlyWeak
                ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                : "border-slate-700 bg-slate-950 text-slate-300"
            }`}
          >
            {onlyWeak ? "✓ Только слабые / ошибки" : "Все вопросы"}
          </button>

          <button
            onClick={() => setSeed((s) => s + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Перемешать</span>
          </button>
        </div>
      </div>

      {/* Live Score Strip */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-center">
          <div className="text-xs text-slate-400">Вопрос</div>
          <div className="text-base font-bold text-white">
            {(currentIndex % pool.length) + 1} / {pool.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-center">
          <div className="text-xs text-slate-400">Точность сессии</div>
          <div className="text-base font-bold text-emerald-400">
            {sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0}% (
            {sessionCorrect}/{sessionTotal})
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-center">
          <div className="text-xs text-slate-400">Серия без ошибок</div>
          <div className="text-base font-bold text-amber-400 flex items-center justify-center gap-1">
            <Flame className="h-4 w-4" />
            <span>{streak}</span>
          </div>
        </div>
        <div className="hidden sm:block rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-center">
          <div className="text-xs text-slate-400">Статьи вопроса</div>
          <div className="text-xs font-semibold text-indigo-300 truncate mt-1">
            {current.question.articles.join(", ")}
          </div>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-6 shadow-xl">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              Билетный вопрос №{current.question.n}: <strong>{current.question.text}</strong>
            </span>
            <span className="rounded-md bg-slate-800 px-2.5 py-0.5 text-indigo-300">
              Конспект: {current.question.notes.join(", ")}
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white leading-snug pt-1">
            {current.item.q}
          </h3>
        </div>

        {/* Options List */}
        <div className="space-y-3">
          {current.item.options.map((opt, idx) => {
            let btnStyle =
              "border-slate-800 bg-slate-950/80 text-slate-200 hover:border-indigo-500/60 hover:bg-slate-900";
            if (isAnswered) {
              if (idx === current.item.correct) {
                btnStyle =
                  "border-emerald-500 bg-emerald-500/15 text-emerald-200 font-semibold";
              } else if (idx === selectedOption) {
                btnStyle = "border-rose-500 bg-rose-500/15 text-rose-200";
              } else {
                btnStyle = "border-slate-800/60 bg-slate-950/40 text-slate-500";
              }
            }

            return (
              <button
                key={idx}
                disabled={isAnswered}
                onClick={() => handleSelectOption(idx)}
                className={`w-full flex items-start gap-3 rounded-xl border p-4 text-left text-sm transition ${btnStyle}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-current/30 text-xs font-bold">
                  {["А", "Б", "В", "Г"][idx] || idx + 1}
                </span>
                <span className="flex-1 leading-relaxed">{opt}</span>
                {isAnswered && idx === current.item.correct && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                )}
                {isAnswered && idx === selectedOption && idx !== current.item.correct && (
                  <XCircle className="h-5 w-5 text-rose-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation & Next Button */}
        {isAnswered && (
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div
              className={`rounded-xl border p-4 space-y-2 ${
                isCorrect
                  ? "border-emerald-500/40 bg-emerald-950/20"
                  : "border-rose-500/40 bg-rose-950/20"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-bold">
                {isCorrect ? (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Верно!
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4" />
                    Ошибка (записана в журнал разбора ошибок)
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                <strong>Правовое обоснование:</strong> {current.item.explain}
              </p>
              {current.question.traps.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 text-xs text-amber-300 flex items-start gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Ловушка по теме:</strong> {current.question.traps[0]}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white hover:bg-indigo-500 transition shadow-lg"
              >
                <span>Следующий вопрос</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
