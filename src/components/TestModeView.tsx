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
  Scale,
  Sparkles,
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
  const [onlyHard, setOnlyHard] = useState<boolean>(false);
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
        if (onlyHard && !item.isHard) return;
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
  }, [db.questions, activeSubject, moduleFilter, onlyWeak, onlyHard, seed, state.errors, state.progress]);

  useEffect(() => {
    setCurrentIndex(0);
    setSelectedOption(null);
  }, [activeSubject, moduleFilter, onlyWeak, onlyHard, seed]);

  if (pool.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center space-y-4">
        <p className="text-lg font-bold text-white">
          Нет тестовых вопросов по выбранному фильтру
        </p>
        <p className="text-sm text-slate-400">
          Попробуйте отключить фильтр «Только казусы» или «Только слабые»
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => {
              setOnlyHard(false);
              setOnlyWeak(false);
              setModuleFilter("all");
            }}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition"
          >
            Сбросить фильтры и показать все вопросы
          </button>
        </div>
      </div>
    );
  }

  const current = pool[currentIndex % pool.length];

  // Deterministically shuffle options based on question ID + question prompt + seed
  // so each question displays options in pseudo-random order (uniform ~25% distribution across А, Б, В, Г)
  const displayOptions = useMemo(() => {
    if (!current) return [];
    const items = current.item.options.map((text, originalIndex) => ({
      text,
      originalIndex,
    }));
    let hash = 0;
    const str = `${current.id}:${current.item.q}:${seed}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.abs(Math.sin(hash * 41 + i * 17)) * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }, [current, seed]);

  const isAnswered = selectedOption !== null;
  const isCorrect =
    selectedOption !== null &&
    displayOptions[selectedOption]?.originalIndex === current?.item.correct;

  const handleSelectOption = (displayIdx: number) => {
    if (isAnswered || !current) return;
    setSelectedOption(displayIdx);
    const chosenOriginalIdx = displayOptions[displayIdx]?.originalIndex;
    const ok = chosenOriginalIdx === current.item.correct;
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
        userAnswer: displayOptions[displayIdx]?.text || "",
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
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 lg:flex-row lg:items-center lg:justify-between shadow-lg">
        <div>
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-sky-400">
            <Scale className="h-4 w-4" />
            <span>Тестовый тренажер: квалификационные казусы, задачи и ловушки УК/ГК РК</span>
          </div>
          <h2 className="mt-1 text-xl sm:text-2xl font-black text-white">
            {db.subjects[activeSubject].title} — Тестирование ({pool.length} вопр.)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Subject Switcher */}
          <div className="inline-flex rounded-xl border border-slate-700 bg-slate-950 p-1">
            <button
              onClick={() => onSelectSubject("up")}
              className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold transition ${
                activeSubject === "up"
                  ? "bg-rose-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              УП РК
            </button>
            <button
              onClick={() => onSelectSubject("gp")}
              className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold transition ${
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
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs sm:text-sm text-slate-200 font-medium"
          >
            <option value="all">Все модули (РК-1 + РК-2)</option>
            <option value="1">Только Модуль 1 (РК-1)</option>
            <option value="2">Только Модуль 2 (РК-2)</option>
          </select>

          {/* Hard Mode Toggle */}
          <button
            onClick={() => setOnlyHard(!onlyHard)}
            className={`rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
              onlyHard
                ? "border-rose-500 bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40"
                : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600 hover:text-white"
            }`}
          >
            <Flame className={`h-4 w-4 ${onlyHard ? "text-rose-400" : "text-amber-400"}`} />
            <span>{onlyHard ? "🔥 Только казусы (ВКЛ)" : "🔥 Хардкор / Казусы"}</span>
          </button>

          {/* Weak Toggle */}
          <button
            onClick={() => setOnlyWeak(!onlyWeak)}
            className={`rounded-xl border px-3 py-2 text-xs sm:text-sm font-semibold transition ${
              onlyWeak
                ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                : "border-slate-700 bg-slate-950 text-slate-300"
            }`}
          >
            {onlyWeak ? "✓ Только ошибки" : "Все темы"}
          </button>

          {/* Reshuffle */}
          <button
            onClick={() => setSeed((s) => s + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Перемешать</span>
          </button>
        </div>
      </div>

      {/* Live Score Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 text-center">
          <div className="text-xs font-semibold text-slate-400">Вопрос теста</div>
          <div className="text-lg sm:text-xl font-black text-white mt-0.5">
            {(currentIndex % pool.length) + 1} / {pool.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 text-center">
          <div className="text-xs font-semibold text-slate-400">Точность сессии</div>
          <div className="text-lg sm:text-xl font-black text-emerald-400 mt-0.5">
            {sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0}% (
            {sessionCorrect}/{sessionTotal})
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 text-center">
          <div className="text-xs font-semibold text-slate-400">Серия без ошибок</div>
          <div className="text-lg sm:text-xl font-black text-amber-400 flex items-center justify-center gap-1 mt-0.5">
            <Flame className="h-5 w-5" />
            <span>{streak}</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 text-center">
          <div className="text-xs font-semibold text-slate-400">Статьи НПА к вопросу</div>
          <div className="text-xs sm:text-sm font-bold text-indigo-300 truncate mt-1">
            {current.question.articles.slice(0, 3).join(", ") || (current.question.subject === "up" ? "УК РК" : "ГК РК")}
          </div>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="space-y-2 border-b border-slate-800 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-slate-400">
            <span className="font-semibold text-slate-300">
              Билетный вопрос №{current.question.n}: <strong>{current.question.text}</strong>
            </span>
            <div className="flex items-center gap-2">
              {current.item.isHard && (
                <span className="rounded-md bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 text-xs font-extrabold text-rose-300 flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  ХАРДКОР: КАЗУС
                </span>
              )}
              <span className="rounded-md bg-slate-800 px-2.5 py-0.5 text-indigo-300 font-medium">
                {current.question.notes[0] || "Конспект"}
              </span>
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white leading-relaxed pt-2">
            {current.item.q}
          </h3>
        </div>

        {/* Options List */}
        <div className="space-y-3.5">
          {displayOptions.map((optItem, displayIdx) => {
            const isThisCorrect = optItem.originalIndex === current.item.correct;
            const isThisSelected = displayIdx === selectedOption;

            let btnStyle =
              "border-slate-800 bg-slate-950/80 text-slate-100 hover:border-indigo-500/60 hover:bg-slate-900";
            if (isAnswered) {
              if (isThisCorrect) {
                btnStyle =
                  "border-emerald-500 bg-emerald-500/15 text-emerald-100 font-bold ring-1 ring-emerald-500/40";
              } else if (isThisSelected) {
                btnStyle = "border-rose-500 bg-rose-500/20 text-rose-100";
              } else {
                btnStyle = "border-slate-800/60 bg-slate-950/40 text-slate-500";
              }
            }

            return (
              <button
                key={displayIdx}
                disabled={isAnswered}
                onClick={() => handleSelectOption(displayIdx)}
                className={`w-full flex items-start gap-3.5 rounded-xl border p-4 sm:p-5 text-left text-base sm:text-lg transition ${btnStyle}`}
              >
                <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border border-current/30 text-sm sm:text-base font-extrabold">
                  {["А", "Б", "В", "Г"][displayIdx] || displayIdx + 1}
                </span>
                <span className="flex-1 leading-relaxed">{optItem.text}</span>
                {isAnswered && isThisCorrect && (
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
                )}
                {isAnswered && isThisSelected && !isThisCorrect && (
                  <XCircle className="h-6 w-6 text-rose-400 shrink-0 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation & Next Button */}
        {isAnswered && (
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div
              className={`rounded-2xl border p-5 space-y-3 ${
                isCorrect
                  ? "border-emerald-500/40 bg-emerald-950/20"
                  : "border-rose-500/40 bg-rose-950/20"
              }`}
            >
              <div className="flex items-center gap-2 text-base font-black">
                {isCorrect ? (
                  <span className="text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Верно! Отличная правовая квалификация.
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-2">
                    <XCircle className="h-5 w-5" />
                    Неверно (записано в Журнал разбора ошибок для повторения)
                  </span>
                )}
              </div>
              <div className="text-sm sm:text-base text-slate-100 leading-relaxed">
                <strong className="text-indigo-300">Нормативное обоснование:</strong> {current.item.explain}
              </div>
              {current.question.traps.length > 0 && (
                <div className="pt-3 border-t border-slate-800/80 text-sm text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-400" />
                  <span className="leading-relaxed">
                    <strong className="text-amber-200">Ловушка на экзамене ЕНУ:</strong> {current.question.traps[0]}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-7 py-3.5 text-sm sm:text-base font-black text-white hover:bg-indigo-500 transition shadow-xl"
              >
                <span>Следующий вопрос</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
