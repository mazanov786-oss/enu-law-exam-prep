"use client";

import React, { useState, useMemo } from "react";
import {
  CoverageStatus,
  ExamDatabase,
  ExamQuestion,
  SubjectId,
  UserStudyState,
} from "@/types/exam";
import {
  Search,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface CatalogViewProps {
  db: ExamDatabase;
  state: UserStudyState;
  activeSubject: SubjectId;
  onSelectSubject: (s: SubjectId) => void;
  onToggleMastered: (questionId: string) => void;
}

export default function CatalogView({
  db,
  state,
  activeSubject,
  onSelectSubject,
  onToggleMastered,
}: CatalogViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [moduleFilter, setModuleFilter] = useState<number | "all">("all");
  const [coverageFilter, setCoverageFilter] = useState<CoverageStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredQuestions = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    return db.questions.filter((q) => {
      if (q.subject !== activeSubject) return false;
      if (moduleFilter !== "all" && q.module !== moduleFilter) return false;
      if (coverageFilter !== "all" && q.coverage !== coverageFilter) return false;
      if (qLower) {
        const inTitle = q.text.toLowerCase().includes(qLower);
        const inArticles = q.articles.some((a) => a.toLowerCase().includes(qLower));
        const inAnswer = q.answer.toLowerCase().includes(qLower);
        const inNum = String(q.n) === qLower;
        if (!inTitle && !inArticles && !inAnswer && !inNum) return false;
      }
      return true;
    });
  }, [db.questions, activeSubject, moduleFilter, coverageFilter, searchQuery]);

  const getCoverageBadge = (cov: CoverageStatus) => {
    if (cov === "full") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          В конспекте Obsidian
        </span>
      );
    }
    if (cov === "partial") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">
          <AlertTriangle className="h-3 w-3" />
          Дополнено по силлабусу
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-300">
        <Sparkles className="h-3 w-3" />
        Добавлено с нуля в Obsidian
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Полный конспект-справочник экзаменационных вопросов УМК ЕНУ + сверка с Obsidian</span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-white">
              {db.subjects[activeSubject].title} ({filteredQuestions.length} вопр.)
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
                Уголовное право (135)
              </button>
              <button
                onClick={() => onSelectSubject("gp")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeSubject === "gp"
                    ? "bg-sky-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Гражданское право (73)
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter Row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2 relative">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по номеру, вопросу, статье (напр. «ст. 32», «виндикация», «УДО»)..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <select
            value={String(moduleFilter)}
            onChange={(e) =>
              setModuleFilter(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
          >
            <option value="all">Все модули (РК-1 + РК-2)</option>
            <option value="1">Модуль 1 (РК-1)</option>
            <option value="2">Модуль 2 (РК-2)</option>
          </select>

          <select
            value={coverageFilter}
            onChange={(e) => setCoverageFilter(e.target.value as CoverageStatus | "all")}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
          >
            <option value="all">Любое покрытие в Obsidian</option>
            <option value="full">Полностью было в конспекте</option>
            <option value="partial">Дополнено по силлабусу (partial)</option>
            <option value="none">Добавлено с нуля (none)</option>
          </select>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {filteredQuestions.map((q) => {
          const isExpanded = expandedId === q.id;
          const p = state.progress[q.id];
          const isMastered = p?.status === "mastered";

          return (
            <div
              key={q.id}
              className={`rounded-2xl border transition ${
                isExpanded
                  ? "border-indigo-500/60 bg-slate-900 shadow-xl"
                  : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
              }`}
            >
              <div
                onClick={() => setExpandedId(isExpanded ? null : q.id)}
                className="cursor-pointer p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold text-indigo-300">
                      Модуль {q.module} • №{q.n}
                    </span>
                    {getCoverageBadge(q.coverage)}
                    <span className="text-xs text-slate-400">
                      Статьи: {q.articles.slice(0, 3).join(", ")}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white">{q.text}</h3>
                  {q.gaps && (
                    <div className="text-xs text-amber-300/90">
                      <strong>Что дополнено в конспект:</strong> {q.gaps}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMastered(q.id);
                    }}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      isMastered
                        ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                        : "border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
                    }`}
                  >
                    {isMastered ? "✓ Выучено" : "Отметить выученным"}
                  </button>
                  <div className="p-1.5 text-slate-400">
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-800 p-5 space-y-5 bg-slate-950/50 rounded-b-2xl">
                  {/* Plan & Notes */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                        План устного ответа
                      </div>
                      <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm text-slate-200">
                        {q.plan.map((pt, i) => (
                          <li key={i}>{pt.replace(/^\d+\.\s*/, "")}</li>
                        ))}
                      </ol>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1.5">
                          Нормативные акты и статьи РК
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {q.articles.map((a, i) => (
                            <span
                              key={i}
                              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Заметки в Obsidian
                        </div>
                        <div className="text-xs text-slate-300">
                          {q.notes.map((n) => `[[${n}]]`).join(", ")}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Full Model Answer */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                      Эталонный ответ на экзамене
                    </div>
                    <div className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                      {q.answer}
                    </div>
                  </div>

                  {/* Traps & Followups */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 space-y-1.5">
                      <div className="text-xs font-bold text-amber-300">
                        Ловушки квалификации:
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-xs text-slate-200">
                        {q.traps.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/15 p-4 space-y-1.5">
                      <div className="text-xs font-bold text-indigo-300">
                        Дополнительные вопросы экзаменатора:
                      </div>
                      <ul className="list-decimal list-inside space-y-1 text-xs text-slate-200">
                        {q.followups.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
