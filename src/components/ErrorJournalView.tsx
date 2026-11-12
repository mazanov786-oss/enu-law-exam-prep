"use client";

import React, { useState } from "react";
import {
  ErrorRecord,
  ErrorSource,
  ExamDatabase,
  SubjectId,
  UserStudyState,
} from "@/types/exam";
import {
  ShieldAlert,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  BookOpen,
  Play,
  Filter,
} from "lucide-react";

interface ErrorJournalViewProps {
  db: ExamDatabase;
  state: UserStudyState;
  activeSubject: SubjectId;
  onSelectSubject: (s: SubjectId) => void;
  onResolveError: (errorId: string) => void;
  onClearResolved: () => void;
  onNavigateTab: (tab: string) => void;
}

export default function ErrorJournalView({
  db,
  state,
  activeSubject,
  onSelectSubject,
  onResolveError,
  onClearResolved,
  onNavigateTab,
}: ErrorJournalViewProps) {
  const [sourceFilter, setSourceFilter] = useState<ErrorSource | "all">("all");
  const [showResolved, setShowResolved] = useState<boolean>(false);
  const [showTrapsBank, setShowTrapsBank] = useState<boolean>(false);

  const filteredErrors = state.errors.filter((err) => {
    if (err.subject !== activeSubject) return false;
    if (!showResolved && err.resolved) return false;
    if (sourceFilter !== "all" && err.source !== sourceFilter) return false;
    return true;
  });

  const subjectQuestions = db.questions.filter((q) => q.subject === activeSubject);

  const sourceBadge = (src: ErrorSource) => {
    switch (src) {
      case "ticket":
        return (
          <span className="rounded-md bg-indigo-500/20 border border-indigo-500/40 px-2 py-0.5 text-xs font-semibold text-indigo-300">
            Устный билет
          </span>
        );
      case "mcq":
        return (
          <span className="rounded-md bg-sky-500/20 border border-sky-500/40 px-2 py-0.5 text-xs font-semibold text-sky-300">
            Тест (MCQ)
          </span>
        );
      case "cloze":
        return (
          <span className="rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-xs font-semibold text-emerald-300">
            Прочерк
          </span>
        );
      default:
        return (
          <span className="rounded-md bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-xs font-semibold text-amber-300">
            Карточка
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Аналитика пробелов, забытых статей УК/ГК РК и ловушек экзаменатора</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-white">
            Разбор ошибок — {db.subjects[activeSubject].title}
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

          <button
            onClick={() => setShowTrapsBank(!showTrapsBank)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
              showTrapsBank
                ? "border-amber-500 bg-amber-500/20 text-amber-300"
                : "border-slate-700 bg-slate-950 text-slate-300 hover:text-white"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span>
              {showTrapsBank
                ? "Вернуться к журналу моих ошибок"
                : "Справочник всех ловушек экзаменатора"}
            </span>
          </button>

          <button
            onClick={() => onNavigateTab("ticket")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Отработать слабые билеты</span>
          </button>
        </div>
      </div>

      {showTrapsBank ? (
        /* Complete Examiner Traps Bank */
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-5 text-sm sm:text-base text-amber-200">
            Здесь собраны все <strong>ловушки квалификации и частые ошибки студентов</strong> по каждому вопросу силлабуса {db.subjects[activeSubject].title}.
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {subjectQuestions.map((q) => (
              <div
                key={q.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-2.5 shadow-md"
              >
                <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                  <span className="font-extrabold text-indigo-300">
                    Вопрос №{q.n} (Модуль {q.module})
                  </span>
                  <span className="text-slate-400 font-mono">{q.articles.slice(0, 2).join(", ")}</span>
                </div>
                <h4 className="text-base sm:text-lg font-bold text-white">{q.text}</h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-amber-200/90 pt-1 leading-relaxed">
                  {q.traps.map((t, idx) => (
                    <li key={idx}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Personal Error Log */
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              {(["all", "ticket", "mcq", "cloze"] as const).map((src) => (
                <button
                  key={src}
                  onClick={() => setSourceFilter(src)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                    sourceFilter === src
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {src === "all"
                    ? "Все ошибки"
                    : src === "ticket"
                    ? "Устные билеты"
                    : src === "mcq"
                    ? "Тесты"
                    : "Прочерк"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showResolved}
                  onChange={(e) => setShowResolved(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900"
                />
                <span>Показывать исправленные</span>
              </label>
              {state.errors.some((e) => e.resolved) && (
                <button
                  onClick={onClearResolved}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Очистить исправленные</span>
                </button>
              )}
            </div>
          </div>

          {filteredErrors.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center space-y-3">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">
                Отличная работа! Неотработанных ошибок в этой категории нет
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Все промахи из тестов, прочерков и устных билетов автоматически попадают сюда вместе со статьями УК/ГК РК и подробным правовым разбором.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredErrors.map((err) => {
                const qObj = db.questions.find((q) => q.id === err.questionId);
                return (
                  <div
                    key={err.id}
                    className={`rounded-2xl border p-5 space-y-3 transition ${
                      err.resolved
                        ? "border-slate-800/60 bg-slate-900/40 opacity-70"
                        : "border-rose-500/30 bg-slate-900"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {sourceBadge(err.source)}
                        {qObj && (
                          <span className="text-xs font-semibold text-slate-300">
                            Вопрос №{qObj.n}: {qObj.text}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                          {new Date(err.timestamp).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {!err.resolved && (
                          <button
                            onClick={() => onResolveError(err.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Разобрал и запомнил</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-sm font-bold text-white">{err.prompt}</div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                      <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3">
                        <div className="font-bold text-rose-300 mb-1">Твой ответ:</div>
                        <div className="text-slate-200 line-clamp-4">{err.userAnswer}</div>
                      </div>
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
                        <div className="font-bold text-emerald-300 mb-1">Правильный ответ / Эталон:</div>
                        <div className="text-slate-200 line-clamp-4">{err.expectedAnswer}</div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 text-xs text-slate-300 space-y-1.5">
                      <div>
                        <strong className="text-indigo-300">Разбор:</strong> {err.explanation}
                      </div>
                      {err.missedArticles.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-slate-400">Повторить статьи:</span>
                          {err.missedArticles.map((a, idx) => (
                            <span
                              key={idx}
                              className="rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-amber-300 font-medium"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
