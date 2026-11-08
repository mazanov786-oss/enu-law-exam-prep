"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ExamDatabase,
  ExamQuestion,
  FlashcardItem,
  SubjectId,
  UserStudyState,
} from "@/types/exam";
import {
  BrainCircuit,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface FlattenedCard {
  id: string;
  question: ExamQuestion;
  card: FlashcardItem;
}

interface FlashcardsViewProps {
  db: ExamDatabase;
  state: UserStudyState;
  activeSubject: SubjectId;
  onSelectSubject: (s: SubjectId) => void;
  onRateCard: (questionId: string, boxDelta: number) => void;
}

export default function FlashcardsView({
  db,
  state,
  activeSubject,
  onSelectSubject,
  onRateCard,
}: FlashcardsViewProps) {
  const [moduleFilter, setModuleFilter] = useState<number | "all">("all");
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [flipped, setFlipped] = useState<boolean>(false);
  const [seed, setSeed] = useState<number>(1);
  const [reviewedCount, setReviewedCount] = useState<number>(0);

  const deck = useMemo(() => {
    const list: FlattenedCard[] = [];
    for (const q of db.questions) {
      if (q.subject !== activeSubject) continue;
      if (moduleFilter !== "all" && q.module !== moduleFilter) continue;
      q.cards.forEach((c, idx) => {
        list.push({
          id: `${q.id}-card-${idx}`,
          question: q,
          card: c,
        });
      });
    }
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.abs(Math.sin(seed * 555 + i * 19)) * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [db.questions, activeSubject, moduleFilter, seed]);

  useEffect(() => {
    setCurrentIndex(0);
    setFlipped(false);
  }, [activeSubject, moduleFilter, seed]);

  if (deck.length === 0) return null;

  const current = deck[currentIndex % deck.length];
  const qProg = state.progress[current.question.id];
  const currentBox = qProg?.cardBox || 0;

  const handleRate = (delta: number) => {
    onRateCard(current.question.id, delta);
    setReviewedCount((c) => c + 1);
    setFlipped(false);
    setCurrentIndex((i) => (i + 1) % deck.length);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
            <BrainCircuit className="h-3.5 w-3.5" />
            <span>Интервальные флеш-карточки (метод Лейтнера / Spaced Repetition)</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-white">
            {db.subjects[activeSubject].title} — Карточки ({deck.length} шт.)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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

          <select
            value={String(moduleFilter)}
            onChange={(e) =>
              setModuleFilter(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
          >
            <option value="all">Все модули</option>
            <option value="1">Модуль 1 (РК-1)</option>
            <option value="2">Модуль 2 (РК-2)</option>
          </select>

          <button
            onClick={() => setSeed((s) => s + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Перемешать колоду</span>
          </button>
        </div>
      </div>

      {/* Card Counter & Box Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-1">
        <div>
          Карточка <strong>{(currentIndex % deck.length) + 1}</strong> из{" "}
          <strong>{deck.length}</strong> • Повторено за сессию:{" "}
          <strong className="text-emerald-400">{reviewedCount}</strong>
        </div>
        <div className="flex items-center gap-2">
          <span>Коробка запоминания (0–4):</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((b) => (
              <span
                key={b}
                className={`h-2.5 w-5 rounded-sm ${
                  b <= currentBox ? "bg-amber-400" : "bg-slate-800"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Flip Card */}
      <div
        onClick={() => setFlipped(!flipped)}
        className="cursor-pointer rounded-3xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 p-8 sm:p-12 min-h-[300px] flex flex-col justify-between shadow-2xl hover:border-indigo-500/60 transition"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-indigo-300 font-medium">
            Вопрос №{current.question.n}: {current.question.text}
          </span>
          <span className="text-slate-400">
            {current.question.articles.slice(0, 2).join(", ")}
          </span>
        </div>

        <div className="my-8 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>{flipped ? "ОТВЕТ (ОБОРОТНАЯ СТОРОНА)" : "ВОПРОС КАРТОЧКИ"}</span>
          </div>
          <div
            className={`text-xl sm:text-2xl font-bold leading-relaxed max-w-3xl mx-auto ${
              flipped ? "text-emerald-300" : "text-white"
            }`}
          >
            {flipped ? current.card.back : current.card.front}
          </div>
        </div>

        <div className="flex items-center justify-center text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Нажмите на карточку, чтобы перевернуть
          </span>
        </div>
      </div>

      {/* Spaced Repetition Rating Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setFlipped(false);
              setCurrentIndex((i) => (i - 1 + deck.length) % deck.length);
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Назад</span>
          </button>
          <button
            onClick={() => {
              setFlipped(false);
              setCurrentIndex((i) => (i + 1) % deck.length);
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            <span>Пропустить</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => handleRate(-2)}
            className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/25 transition"
          >
            Снова (Не знал)
          </button>
          <button
            onClick={() => handleRate(0)}
            className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition"
          >
            Трудно (С запинкой)
          </button>
          <button
            onClick={() => handleRate(1)}
            className="rounded-xl border border-sky-500/40 bg-sky-500/15 px-4 py-2.5 text-xs font-bold text-sky-300 hover:bg-sky-500/25 transition"
          >
            Хорошо (Уверенно)
          </button>
          <button
            onClick={() => handleRate(2)}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Легко (Наизусть)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
