"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  ClozeItem,
  ErrorRecord,
  ExamDatabase,
  ExamQuestion,
  SubjectId,
  UserStudyState,
} from "@/types/exam";
import { checkClozeBlank, parseClozeText } from "@/lib/evaluator";
import { generateRandomSeed, shuffleWithSeed } from "@/lib/shuffle";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  HelpCircle,
  Mic,
  MicOff,
  Scale,
  RotateCcw,
  Eye,
} from "lucide-react";

interface FlattenedCloze {
  id: string;
  question: ExamQuestion;
  item: ClozeItem;
}

interface ClozeModeViewProps {
  db: ExamDatabase;
  state: UserStudyState;
  activeSubject: SubjectId;
  onSelectSubject: (s: SubjectId) => void;
  onRecordCloze: (questionId: string, correct: boolean) => void;
  onAddError: (err: Omit<ErrorRecord, "id" | "timestamp" | "resolved">) => void;
}

export default function ClozeModeView({
  db,
  state,
  activeSubject,
  onSelectSubject,
  onRecordCloze,
  onAddError,
}: ClozeModeViewProps) {
  const [moduleFilter, setModuleFilter] = useState<number | "all">("all");
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [activeBlankIdx, setActiveBlankIdx] = useState<number>(0);
  const [checked, setChecked] = useState<boolean>(false);
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [showHint, setShowHint] = useState<boolean>(false);
  const [seed, setSeed] = useState<number>(() => generateRandomSeed());

  const pool = useMemo(() => {
    const list: FlattenedCloze[] = [];
    for (const q of db.questions) {
      if (q.subject !== activeSubject) continue;
      if (moduleFilter !== "all" && q.module !== moduleFilter) continue;
      q.cloze.forEach((item, idx) => {
        list.push({
          id: `${q.id}-cloze-${idx}`,
          question: q,
          item,
        });
      });
    }
    return shuffleWithSeed(list, seed);
  }, [db.questions, activeSubject, moduleFilter, seed]);

  useEffect(() => {
    setCurrentIndex(0);
    setInputs({});
    setChecked(false);
    setResults({});
    setShowHint(false);
    setActiveBlankIdx(0);
  }, [activeSubject, moduleFilter, seed]);

  const handleVoiceTranscript = useCallback(
    (spoken: string) => {
      setInputs((prev) => ({
        ...prev,
        [activeBlankIdx]: spoken.replace(/[.!?]+$/, "").trim(),
      }));
    },
    [activeBlankIdx]
  );

  const { isListening, isSupported, stopListening, toggleListening } =
    useSpeechRecognition(handleVoiceTranscript);

  if (pool.length === 0) return null;

  const current = pool[currentIndex % pool.length];
  const segments = parseClozeText(current.item.text);
  const blankSegments = segments.filter((s) => s.type === "blank");

  const handleCheck = () => {
    if (isListening) stopListening();
    const resMap: Record<number, boolean> = {};
    let allCorrect = true;
    const expectedList: string[] = [];
    const userList: string[] = [];

    for (const seg of blankSegments) {
      const idx = seg.blankIndex!;
      const userVal = inputs[idx] || "";
      const ok = checkClozeBlank(userVal, seg.options || [seg.content]);
      resMap[idx] = ok;
      if (!ok) allCorrect = false;
      expectedList.push((seg.options || [seg.content]).join(" / "));
      userList.push(userVal || "(пусто)");
    }

    setResults(resMap);
    setChecked(true);
    onRecordCloze(current.question.id, allCorrect);

    if (!allCorrect) {
      onAddError({
        questionId: current.question.id,
        subject: current.question.subject,
        source: "cloze",
        prompt: current.item.text.replace(/\{\{([^}]+)\}\}/g, "___"),
        userAnswer: userList.join("; "),
        expectedAnswer: expectedList.join("; "),
        explanation: `Нормативный источник: ${current.item.hint}. Вопрос №${current.question.n}: ${current.question.text}`,
        missedArticles: [current.item.hint],
        missedKeywords: expectedList,
      });
    }
  };

  const handleRevealAnswers = () => {
    const filled: Record<number, string> = {};
    const resMap: Record<number, boolean> = {};
    for (const seg of blankSegments) {
      const idx = seg.blankIndex!;
      filled[idx] = seg.options?.[0] || seg.content;
      resMap[idx] = true;
    }
    setInputs(filled);
    setResults(resMap);
    setChecked(true);
  };

  const handleNext = () => {
    if (isListening) stopListening();
    setInputs({});
    setChecked(false);
    setResults({});
    setShowHint(false);
    setActiveBlankIdx(0);
    setCurrentIndex((i) => (i + 1) % pool.length);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <Scale className="h-3.5 w-3.5" />
            <span>Режим «Прочерк» — впиши пропущенный термин, срок или статью кодекса</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-white">
            {db.subjects[activeSubject].title} — Тренажер норм ({pool.length} упр.)
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
            onClick={() => setSeed(generateRandomSeed())}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Перемешать</span>
          </button>
        </div>
      </div>

      {/* Main Cloze Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div className="text-xs text-slate-400">
            Упражнение {(currentIndex % pool.length) + 1} из {pool.length} • Вопрос №
            {current.question.n}: <strong className="text-slate-200">{current.question.text}</strong>
          </div>
          <div className="flex items-center gap-2">
            {isSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  isListening
                    ? "bg-rose-600 text-white animate-pulse"
                    : "border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-3.5 w-3.5" />
                    <span>Голос включен (в пропуск #{activeBlankIdx + 1})</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Продиктовать пропуск</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowHint(!showHint)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>{showHint ? `Источник: ${current.item.hint}` : "Подсказка (статья)"}</span>
            </button>
          </div>
        </div>

        {/* Interactive Sentence with Inline Blank Inputs */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-6 sm:p-8 read-lg leading-loose text-slate-100 font-medium">
          {segments.map((seg, i) => {
            if (seg.type === "text") {
              return <span key={i}>{seg.content}</span>;
            }
            const bIdx = seg.blankIndex!;
            const val = inputs[bIdx] || "";
            const isOk = results[bIdx];

            let borderClass = "border-indigo-500/60 bg-indigo-950/30 text-indigo-200";
            if (checked) {
              borderClass = isOk
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-200 font-bold"
                : "border-rose-500 bg-rose-500/20 text-rose-200 font-bold";
            } else if (activeBlankIdx === bIdx) {
              borderClass = "border-indigo-400 bg-indigo-950/60 text-white ring-2 ring-indigo-500/30";
            }

            return (
              <span key={i} className="inline-flex items-center mx-2 align-baseline">
                <input
                  type="text"
                  disabled={checked}
                  value={val}
                  onFocus={() => setActiveBlankIdx(bIdx)}
                  onChange={(e) =>
                    setInputs((prev) => ({ ...prev, [bIdx]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !checked) {
                      handleCheck();
                    }
                  }}
                  placeholder={`пропуск #${bIdx + 1}`}
                  style={{
                    width: `${Math.max(160, (seg.content.length + 4) * 12)}px`,
                  }}
                  className={`rounded-lg border px-3.5 py-1.5 text-base sm:text-lg font-bold focus:outline-none transition ${borderClass}`}
                />
              </span>
            );
          })}
        </div>

        {/* Verification Results */}
        {checked && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
            <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-400">
              Эталонные значения пропусков ({current.item.hint}):
            </div>
            <div className="flex flex-wrap gap-2.5">
              {blankSegments.map((seg) => {
                const idx = seg.blankIndex!;
                const ok = results[idx];
                return (
                  <div
                    key={idx}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm sm:text-base font-semibold ${
                      ok
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                    }`}
                  >
                    {ok ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-400" />
                    )}
                    <span>
                      Пропуск #{idx + 1}:{" "}
                      <strong className="text-white">{(seg.options || [seg.content]).join(" ИЛИ ")}</strong>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {!checked ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleCheck}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white hover:bg-emerald-500 transition shadow-lg"
              >
                <CheckCircle2 className="h-5 w-5" />
                <span>Проверить вписанные термины</span>
              </button>
              <button
                type="button"
                onClick={handleRevealAnswers}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs sm:text-sm font-bold text-slate-300 hover:text-white"
              >
                <Eye className="h-4 w-4" />
                <span>Показать ответ</span>
              </button>
            </div>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-black text-white hover:bg-indigo-500 transition shadow-lg"
          >
            <span>Следующая норма</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
