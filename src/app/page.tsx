"use client";

import React, { useState, useEffect } from "react";
import rawExamData from "@/data/exam-data.json";
import {
  ErrorRecord,
  ExamDatabase,
  ExamDeadlines,
  SubjectId,
  TicketHistoryItem,
  UserStudyState,
} from "@/types/exam";
import {
  computeMasteryStatus,
  getDefaultState,
  getOrInitProgress,
  loadStudyState,
  saveStudyState,
} from "@/lib/storage";
import DashboardView from "@/components/DashboardView";
import TicketSimulatorView from "@/components/TicketSimulatorView";
import TestModeView from "@/components/TestModeView";
import ClozeModeView from "@/components/ClozeModeView";
import FlashcardsView from "@/components/FlashcardsView";
import ErrorJournalView from "@/components/ErrorJournalView";
import CatalogView from "@/components/CatalogView";
import {
  LayoutDashboard,
  Mic,
  FileCheck2,
  Scale,
  BrainCircuit,
  ShieldAlert,
  BookOpen,
  GraduationCap,
} from "lucide-react";

const examDb = rawExamData as unknown as ExamDatabase;

export default function ExamPrepApp() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [activeSubject, setActiveSubject] = useState<SubjectId>("up");
  const [state, setState] = useState<UserStudyState>(getDefaultState);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    const loaded = loadStudyState();
    setState(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const size = state.fontSize || "lg";
      document.documentElement.classList.remove("font-size-md", "font-size-lg", "font-size-xl");
      document.documentElement.classList.add(`font-size-${size}`);
    }
  }, [state.fontSize]);

  const updateState = (updater: (prev: UserStudyState) => UserStudyState) => {
    setState((prev) => {
      const next = updater(prev);
      saveStudyState(next);
      return next;
    });
  };

  const handleSetFontSize = (size: "md" | "lg" | "xl") => {
    updateState((prev) => ({
      ...prev,
      fontSize: size,
    }));
  };

  const handleRecordQuestionScore = (questionId: string, score: number) => {
    updateState((prev) => {
      const curr = getOrInitProgress(prev, questionId);
      const updated = {
        ...curr,
        lastPracticed: new Date().toISOString(),
        oralAttempts: curr.oralAttempts + 1,
        oralScoreBest: Math.max(curr.oralScoreBest || 0, score),
      };
      updated.status = computeMasteryStatus(updated);
      return {
        ...prev,
        progress: {
          ...prev.progress,
          [questionId]: updated,
        },
      };
    });
  };

  const handleRecordMcq = (questionId: string, correct: boolean) => {
    updateState((prev) => {
      const curr = getOrInitProgress(prev, questionId);
      const updated = {
        ...curr,
        lastPracticed: new Date().toISOString(),
        mcqCorrect: curr.mcqCorrect + (correct ? 1 : 0),
        mcqWrong: curr.mcqWrong + (correct ? 0 : 1),
      };
      updated.status = computeMasteryStatus(updated);
      return {
        ...prev,
        progress: {
          ...prev.progress,
          [questionId]: updated,
        },
      };
    });
  };

  const handleRecordCloze = (questionId: string, correct: boolean) => {
    updateState((prev) => {
      const curr = getOrInitProgress(prev, questionId);
      const updated = {
        ...curr,
        lastPracticed: new Date().toISOString(),
        clozeCorrect: curr.clozeCorrect + (correct ? 1 : 0),
        clozeWrong: curr.clozeWrong + (correct ? 0 : 1),
      };
      updated.status = computeMasteryStatus(updated);
      return {
        ...prev,
        progress: {
          ...prev.progress,
          [questionId]: updated,
        },
      };
    });
  };

  const handleRateCard = (questionId: string, boxDelta: number) => {
    updateState((prev) => {
      const curr = getOrInitProgress(prev, questionId);
      const nextBox = Math.max(0, Math.min(4, curr.cardBox + boxDelta));
      const updated = {
        ...curr,
        lastPracticed: new Date().toISOString(),
        cardBox: nextBox,
      };
      updated.status = computeMasteryStatus(updated);
      return {
        ...prev,
        progress: {
          ...prev.progress,
          [questionId]: updated,
        },
      };
    });
  };

  const handleToggleMastered = (questionId: string) => {
    updateState((prev) => {
      const curr = getOrInitProgress(prev, questionId);
      const isCurrentlyMastered = curr.status === "mastered";
      const updated = {
        ...curr,
        lastPracticed: new Date().toISOString(),
        oralScoreBest: isCurrentlyMastered ? 0 : 95,
        status: isCurrentlyMastered ? ("learning" as const) : ("mastered" as const),
      };
      return {
        ...prev,
        progress: {
          ...prev.progress,
          [questionId]: updated,
        },
      };
    });
  };

  const handleAddError = (
    err: Omit<ErrorRecord, "id" | "timestamp" | "resolved">
  ) => {
    updateState((prev) => {
      const newErr: ErrorRecord = {
        ...err,
        id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        resolved: false,
      };
      return {
        ...prev,
        errors: [newErr, ...prev.errors].slice(0, 250),
      };
    });
  };

  const handleResolveError = (errorId: string) => {
    updateState((prev) => ({
      ...prev,
      errors: prev.errors.map((e) =>
        e.id === errorId ? { ...e, resolved: true } : e
      ),
    }));
  };

  const handleClearResolved = () => {
    updateState((prev) => ({
      ...prev,
      errors: prev.errors.filter((e) => !e.resolved),
    }));
  };

  const handleSaveTicketHistory = (ticket: TicketHistoryItem) => {
    updateState((prev) => ({
      ...prev,
      tickets: [ticket, ...prev.tickets].slice(0, 100),
    }));
  };

  const handleUpdateDeadlines = (deadlines: ExamDeadlines) => {
    updateState((prev) => ({
      ...prev,
      deadlines,
    }));
  };

  const unresolvedErrorCount = state.errors.filter((e) => !e.resolved).length;

  const navItems = [
    { id: "dashboard", label: "Дашборд и Дедлайн", icon: LayoutDashboard },
    { id: "ticket", label: "Билет (3 вопроса)", icon: Mic },
    { id: "test", label: "Тесты (MCQ)", icon: FileCheck2 },
    { id: "cloze", label: "Прочерк", icon: Scale },
    { id: "cards", label: "Карточки", icon: BrainCircuit },
    {
      id: "errors",
      label: "Разбор ошибок",
      icon: ShieldAlert,
      badge: unresolvedErrorCount > 0 ? unresolvedErrorCount : undefined,
    },
    { id: "catalog", label: "База (208 вопр.)", icon: BookOpen },
  ];

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        Загрузка базы знаний УП РК и ГП РК...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* Sticky Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveTab("dashboard")}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <div className="text-base font-black tracking-tight text-white group-hover:text-indigo-300 transition">
                  LEX.ENU • Экзаменационный Тренажер
                </div>
                <div className="text-xs text-slate-400">
                  Уголовное и Гражданское право РК (Общая часть)
                </div>
              </div>
            </button>

            {/* Mobile Subject Badge & Font Switcher */}
            <div className="flex lg:hidden items-center gap-1.5">
              <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
                <button
                  type="button"
                  onClick={() => handleSetFontSize("md")}
                  className={`rounded-lg px-2 py-0.5 text-xs font-bold ${
                    (state.fontSize || "lg") === "md" ? "bg-indigo-600 text-white" : "text-slate-400"
                  }`}
                >
                  А-
                </button>
                <button
                  type="button"
                  onClick={() => handleSetFontSize("lg")}
                  className={`rounded-lg px-2 py-0.5 text-xs font-bold ${
                    (state.fontSize || "lg") === "lg" ? "bg-indigo-600 text-white" : "text-slate-400"
                  }`}
                >
                  А
                </button>
                <button
                  type="button"
                  onClick={() => handleSetFontSize("xl")}
                  className={`rounded-lg px-2 py-0.5 text-xs font-bold ${
                    state.fontSize === "xl" ? "bg-indigo-600 text-white" : "text-slate-400"
                  }`}
                >
                  А+
                </button>
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
                <button
                  onClick={() => setActiveSubject("up")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                    activeSubject === "up"
                      ? "bg-rose-600 text-white"
                      : "text-slate-400"
                  }`}
                >
                  УП
                </button>
                <button
                  onClick={() => setActiveSubject("gp")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                    activeSubject === "gp"
                      ? "bg-sky-600 text-white"
                      : "text-slate-400"
                  }`}
                >
                  ГП
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Desktop Font Size Switcher */}
            <div className="hidden lg:flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1">
              <span className="px-2 text-xs font-semibold text-slate-400">Шрифт:</span>
              <button
                type="button"
                onClick={() => handleSetFontSize("md")}
                title="Стандартный размер (16px)"
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  (state.fontSize || "lg") === "md"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                А-
              </button>
              <button
                type="button"
                onClick={() => handleSetFontSize("lg")}
                title="Крупный комфортный (18.5px)"
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  (state.fontSize || "lg") === "lg"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                А (18px)
              </button>
              <button
                type="button"
                onClick={() => handleSetFontSize("xl")}
                title="Экстра-крупный (21px)"
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  state.fontSize === "xl"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                А+ (21px)
              </button>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-bold transition ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                        : "text-slate-300 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          isActive
                            ? "bg-white text-indigo-700"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {activeTab === "dashboard" && (
          <DashboardView
            db={examDb}
            state={state}
            activeSubject={activeSubject}
            onSelectSubject={setActiveSubject}
            onNavigateTab={setActiveTab}
            onUpdateDeadlines={handleUpdateDeadlines}
            onImportState={(imported) => {
              setState(imported);
              saveStudyState(imported);
            }}
            onResetState={() => {
              const fresh = getDefaultState();
              setState(fresh);
              saveStudyState(fresh);
            }}
          />
        )}

        {activeTab === "ticket" && (
          <TicketSimulatorView
            db={examDb}
            state={state}
            activeSubject={activeSubject}
            onSelectSubject={setActiveSubject}
            onRecordQuestionScore={handleRecordQuestionScore}
            onAddError={handleAddError}
            onSaveTicketHistory={handleSaveTicketHistory}
          />
        )}

        {activeTab === "test" && (
          <TestModeView
            db={examDb}
            state={state}
            activeSubject={activeSubject}
            onSelectSubject={setActiveSubject}
            onRecordMcq={handleRecordMcq}
            onAddError={handleAddError}
          />
        )}

        {activeTab === "cloze" && (
          <ClozeModeView
            db={examDb}
            state={state}
            activeSubject={activeSubject}
            onSelectSubject={setActiveSubject}
            onRecordCloze={handleRecordCloze}
            onAddError={handleAddError}
          />
        )}

        {activeTab === "cards" && (
          <FlashcardsView
            db={examDb}
            state={state}
            activeSubject={activeSubject}
            onSelectSubject={setActiveSubject}
            onRateCard={handleRateCard}
          />
        )}

        {activeTab === "errors" && (
          <ErrorJournalView
            db={examDb}
            state={state}
            activeSubject={activeSubject}
            onSelectSubject={setActiveSubject}
            onResolveError={handleResolveError}
            onClearResolved={handleClearResolved}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === "catalog" && (
          <CatalogView
            db={examDb}
            state={state}
            activeSubject={activeSubject}
            onSelectSubject={setActiveSubject}
            onToggleMastered={handleToggleMastered}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            ЕНУ им. Л. Н. Гумилёва • Юридический факультет • UPRK 2208 & GPRK 2207
          </span>
          <span>
            Синхронизировано с конспектами Obsidian (УК РК 2014 г. / ГК РК Общая часть)
          </span>
        </div>
      </footer>
    </div>
  );
}
