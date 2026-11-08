"use client";

import React, { useState } from "react";
import {
  ExamDatabase,
  ExamDeadlines,
  SubjectId,
  UserStudyState,
} from "@/types/exam";
import { calculateSubjectReadiness } from "@/lib/storage";
import { getEnuGrade } from "@/lib/evaluator";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  GraduationCap,
  AlertTriangle,
  Sparkles,
  BookOpen,
  Mic,
  FileCheck2,
  BrainCircuit,
  Scale,
  Settings,
  Download,
  Upload,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

interface DashboardViewProps {
  db: ExamDatabase;
  state: UserStudyState;
  activeSubject: SubjectId;
  onSelectSubject: (s: SubjectId) => void;
  onNavigateTab: (tab: string) => void;
  onUpdateDeadlines: (d: ExamDeadlines) => void;
  onImportState: (s: UserStudyState) => void;
  onResetState: () => void;
}

export default function DashboardView({
  db,
  state,
  activeSubject,
  onSelectSubject,
  onNavigateTab,
  onUpdateDeadlines,
  onImportState,
  onResetState,
}: DashboardViewProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [upDate, setUpDate] = useState(state.deadlines.upDate);
  const [gpDate, setGpDate] = useState(state.deadlines.gpDate);
  const [apiKey, setApiKey] = useState(state.deadlines.geminiApiKey || "");

  const upStats = calculateSubjectReadiness(db.questions, state.progress, "up");
  const gpStats = calculateSubjectReadiness(db.questions, state.progress, "gp");
  const overallStats = calculateSubjectReadiness(db.questions, state.progress);

  const upMod1 = calculateSubjectReadiness(db.questions, state.progress, "up", 1);
  const upMod2 = calculateSubjectReadiness(db.questions, state.progress, "up", 2);
  const gpMod1 = calculateSubjectReadiness(db.questions, state.progress, "gp", 1);
  const gpMod2 = calculateSubjectReadiness(db.questions, state.progress, "gp", 2);

  const getDaysRemaining = (dateStr: string) => {
    const target = new Date(dateStr + "T09:00:00");
    const now = new Date();
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 3600 * 24));
    return Math.max(0, diff);
  };

  const upDays = getDaysRemaining(state.deadlines.upDate);
  const gpDays = getDaysRemaining(state.deadlines.gpDate);

  const upRemaining = upStats.total - upStats.mastered;
  const gpRemaining = gpStats.total - gpStats.mastered;

  const upDailyPace = upDays > 0 ? Math.ceil(upRemaining / upDays) : upRemaining;
  const gpDailyPace = gpDays > 0 ? Math.ceil(gpRemaining / gpDays) : gpRemaining;

  const unresolvedErrors = state.errors.filter((e) => !e.resolved);

  // Obsidian coverage statistics
  const fullCount = db.questions.filter((q) => q.coverage === "full").length;
  const partialCount = db.questions.filter((q) => q.coverage === "partial").length;
  const noneCount = db.questions.filter((q) => q.coverage === "none").length;

  const predictedGrade = getEnuGrade(
    activeSubject === "up" ? upStats.readinessPercent : gpStats.readinessPercent
  );

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateDeadlines({
      ...state.deadlines,
      upDate,
      gpDate,
      geminiApiKey: apiKey.trim(),
    });
    setShowSettings(false);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enu-exam-prep-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result));
        if (parsed && typeof parsed === "object") {
          onImportState(parsed);
          alert("Прогресс успешно импортирован!");
        }
      } catch {
        alert("Не удалось прочитать JSON-файл резервной копии.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Top Hero Banner: Deadlines & Readiness Scale */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/60 p-6 shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
              <GraduationCap className="h-3.5 w-3.5" />
              <span>ЕНУ им. Л. Н. Гумилёва • 2 курс Юриспруденция • Зимняя сессия</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Шкала готовности к устным экзаменам (УП и ГП РК)
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Все <strong>{db.questions.length} официальных вопросов</strong> из УМК («Уголовное право РК — Общая часть» и «Гражданское право РК — Общая часть») сверены с твоими конспектами в Obsidian. Формат сессии: <strong>устный экзамен, 3 вопроса в 1 билете</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
              <Flame className="h-5 w-5 text-amber-400" />
              <div>
                <div className="text-xs text-amber-200/80">Серия дней</div>
                <div className="text-lg font-bold text-amber-300">{state.streakDays} дн.</div>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              <Settings className="h-4 w-4 text-slate-400" />
              <span>Дедлайны и настройки</span>
            </button>
          </div>
        </div>

        {/* Settings Drawer */}
        {showSettings && (
          <form
            onSubmit={handleSaveSettings}
            className="mt-6 rounded-xl border border-slate-700/80 bg-slate-950/90 p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-400" />
                Настройка дат экзаменов, ИИ-экзаменатора и резервного копирования
              </h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Закрыть
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Дата экзамена по Уголовному праву РК
                </label>
                <input
                  type="date"
                  value={upDate}
                  onChange={(e) => setUpDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Дата экзамена по Гражданскому праву РК
                </label>
                <input
                  type="date"
                  value={gpDate}
                  onChange={(e) => setGpDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Gemini API Key (опционально для ИИ-разбора)
                </label>
                <input
                  type="password"
                  placeholder="AIzaSy... (необязательно)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Экспорт прогресса (.json)
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700">
                  <Upload className="h-3.5 w-3.5" />
                  Импорт прогресса
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Сбросить весь прогресс тренировок?")) {
                      onResetState();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
                >
                  Сбросить статистику
                </button>
              </div>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition"
              >
                Сохранить настройки
              </button>
            </div>
          </form>
        )}

        {/* Overall Readiness Progress Bar */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Общий индекс готовности к сессии
              </span>
              <span className="text-lg font-bold text-indigo-400">
                {overallStats.readinessPercent}% ({overallStats.mastered} из {overallStats.total} вопросов усвоено)
              </span>
            </div>
            <div className="h-3.5 w-full overflow-hidden rounded-full bg-slate-800 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${Math.max(2, overallStats.readinessPercent)}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
                <div className="font-bold text-emerald-400 text-sm">{overallStats.mastered}</div>
                <div className="text-slate-400">Выучено (A/B)</div>
              </div>
              <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-2">
                <div className="font-bold text-sky-400 text-sm">{overallStats.review}</div>
                <div className="text-slate-400">На повторении</div>
              </div>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2">
                <div className="font-bold text-amber-400 text-sm">{overallStats.learning}</div>
                <div className="text-slate-400">В процессе</div>
              </div>
              <div className="rounded-lg bg-slate-800/80 border border-slate-700/60 p-2">
                <div className="font-bold text-slate-300 text-sm">{overallStats.unseen}</div>
                <div className="text-slate-400">Не пройдено</div>
              </div>
            </div>
          </div>

          {/* Predicted ENU Grade Card */}
          <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Прогноз оценки ЕНУ ({activeSubject === "up" ? "УП РК" : "ГП РК"})
              </span>
              <span
                className={`rounded-lg border px-2.5 py-0.5 text-sm font-bold ${predictedGrade.color}`}
              >
                {predictedGrade.letter} (GPA {predictedGrade.gpa})
              </span>
            </div>
            <p className="my-2 text-xs text-slate-300 leading-relaxed">
              {predictedGrade.description}
            </p>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
              <span>Сдано пробных билетов:</span>
              <span className="font-semibold text-white">
                {state.tickets.filter((t) => t.subject === activeSubject).length} шт.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subject Deadline & Module Cards (UP vs GP) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Criminal Law Card */}
        <div
          onClick={() => onSelectSubject("up")}
          className={`cursor-pointer rounded-2xl border p-5 transition-all ${
            activeSubject === "up"
              ? "border-indigo-500 bg-slate-900/95 shadow-lg shadow-indigo-500/10"
              : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-xs font-semibold text-rose-300">
                  {db.subjects.up.code}
                </span>
                <span className="text-xs text-slate-400">{db.subjects.up.teacher}</span>
              </div>
              <h2 className="mt-1.5 text-lg font-bold text-white">
                {db.subjects.up.title}
              </h2>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200">
                <Clock className="h-3.5 w-3.5 text-rose-400" />
                <span>До экзамена: <strong>{upDays} дн.</strong> ({state.deadlines.upDate})</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Темп: <strong>{upDailyPace} вопр./день</strong>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">
                  Готовность по Уголовному праву ({upStats.total} вопросов)
                </span>
                <span className="font-bold text-rose-400">{upStats.readinessPercent}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all"
                  style={{ width: `${Math.max(2, upStats.readinessPercent)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-xs text-slate-400">Модуль 1 (Уголовный закон и правонарушение)</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-base font-bold text-white">{upMod1.readinessPercent}%</span>
                  <span className="text-xs text-slate-400">
                    {upMod1.mastered}/{upMod1.total} вопр.
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-xs text-slate-400">Модуль 2 (Наказание, освобождение, ПММХ)</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-base font-bold text-white">{upMod2.readinessPercent}%</span>
                  <span className="text-xs text-slate-400">
                    {upMod2.mastered}/{upMod2.total} вопр.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Civil Law Card */}
        <div
          onClick={() => onSelectSubject("gp")}
          className={`cursor-pointer rounded-2xl border p-5 transition-all ${
            activeSubject === "gp"
              ? "border-indigo-500 bg-slate-900/95 shadow-lg shadow-indigo-500/10"
              : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-xs font-semibold text-sky-300">
                  {db.subjects.gp.code}
                </span>
                <span className="text-xs text-slate-400">{db.subjects.gp.teacher}</span>
              </div>
              <h2 className="mt-1.5 text-lg font-bold text-white">
                {db.subjects.gp.title}
              </h2>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200">
                <Clock className="h-3.5 w-3.5 text-sky-400" />
                <span>До экзамена: <strong>{gpDays} дн.</strong> ({state.deadlines.gpDate})</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Темп: <strong>{gpDailyPace} вопр./день</strong>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">
                  Готовность по Гражданскому праву ({gpStats.total} вопроса)
                </span>
                <span className="font-bold text-sky-400">{gpStats.readinessPercent}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all"
                  style={{ width: `${Math.max(2, gpStats.readinessPercent)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-xs text-slate-400">РК-1 (Субъекты, объекты, сделки)</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-base font-bold text-white">{gpMod1.readinessPercent}%</span>
                  <span className="text-xs text-slate-400">
                    {gpMod1.mastered}/{gpMod1.total} вопр.
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-xs text-slate-400">РК-2 (Вещное, обязательственное, договор)</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-base font-bold text-white">{gpMod2.readinessPercent}%</span>
                  <span className="text-xs text-slate-400">
                    {gpMod2.mastered}/{gpMod2.total} вопр.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Modes Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <button
          onClick={() => onNavigateTab("ticket")}
          className="group flex flex-col justify-between rounded-2xl border border-indigo-500/40 bg-gradient-to-b from-indigo-950/50 to-slate-900 p-4 text-left hover:border-indigo-400 transition"
        >
          <div>
            <div className="inline-flex rounded-xl bg-indigo-500/20 p-2.5 text-indigo-300">
              <Mic className="h-5 w-5" />
            </div>
            <h3 className="mt-3 font-bold text-white group-hover:text-indigo-300">
              Устный билет (3 вопроса)
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Рандомайзер экзаменационного билета с голосовым вводом, таймером и проверкой статей.
            </p>
          </div>
          <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-400">
            <span>Тянуть билет</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </button>

        <button
          onClick={() => onNavigateTab("test")}
          className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-left hover:border-sky-500/50 transition"
        >
          <div>
            <div className="inline-flex rounded-xl bg-sky-500/15 p-2.5 text-sky-400">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <h3 className="mt-3 font-bold text-white group-hover:text-sky-300">
              Тесты с ловушками
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {db.questions.length * 3} тестовых вопросов по статьям УК и ГК РК с мгновенным разбором.
            </p>
          </div>
          <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-sky-400">
            <span>Запустить тест</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </button>

        <button
          onClick={() => onNavigateTab("cloze")}
          className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-left hover:border-emerald-500/50 transition"
        >
          <div>
            <div className="inline-flex rounded-xl bg-emerald-500/15 p-2.5 text-emerald-400">
              <Scale className="h-5 w-5" />
            </div>
            <h3 className="mt-3 font-bold text-white group-hover:text-emerald-300">
              Прочерк (Вписать норму)
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Вписывай вручную или голосом пропущенные термины, сроки, возрасты и номера статей.
            </p>
          </div>
          <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
            <span>Тренировать нормы</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </button>

        <button
          onClick={() => onNavigateTab("cards")}
          className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-left hover:border-amber-500/50 transition"
        >
          <div>
            <div className="inline-flex rounded-xl bg-amber-500/15 p-2.5 text-amber-400">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <h3 className="mt-3 font-bold text-white group-hover:text-amber-300">
              Карточки (Интервалы)
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Свыше {db.questions.length * 4} флеш-карточек по системе Лейтнера для запоминания определений и цифр.
            </p>
          </div>
          <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
            <span>Учить карточки</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </button>

        <button
          onClick={() => onNavigateTab("errors")}
          className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-left hover:border-rose-500/50 transition"
        >
          <div>
            <div className="inline-flex items-center justify-between w-full">
              <div className="rounded-xl bg-rose-500/15 p-2.5 text-rose-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
              {unresolvedErrors.length > 0 && (
                <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 text-xs font-bold text-rose-300">
                  {unresolvedErrors.length} ошибок
                </span>
              )}
            </div>
            <h3 className="mt-3 font-bold text-white group-hover:text-rose-300">
              Разбор ошибок
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Журнал твоих пробелов, забытых статей и ловушек квалификации с режимом отработки.
            </p>
          </div>
          <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-rose-400">
            <span>Разобрать ошибки</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </button>
      </div>

      {/* Obsidian Audit & Syllabus Enrichment Summary */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Sparkles className="h-4 w-4" />
              <span>Аудит силлабусов ЕНУ и твоих конспектов в Obsidian</span>
            </div>
            <h3 className="text-base font-bold text-white">
              Сверка 208 экзаменационных вопросов с базой знаний Obsidian
            </h3>
            <p className="text-xs text-slate-400">
              Все недостающие и частично раскрытые вопросы из силлабусов (УМК УП РК и ГП РК) добавлены в твои конспекты Obsidian и в базу этого тренажера.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab("catalog")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition shrink-0"
          >
            <BookOpen className="h-4 w-4 text-indigo-400" />
            <span>Открыть все 208 вопросов и ответы</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 shrink-0" />
            <div>
              <div className="text-lg font-bold text-white">{fullCount} вопросов</div>
              <div className="text-xs text-slate-400">
                Полностью были в твоих конспектах Obsidian
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <AlertTriangle className="h-8 w-8 text-amber-400 shrink-0" />
            <div>
              <div className="text-lg font-bold text-white">{partialCount} вопросов</div>
              <div className="text-xs text-slate-400">
                Были раскрыты частично — дополнены по силлабусу
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
            <Sparkles className="h-8 w-8 text-indigo-400 shrink-0" />
            <div>
              <div className="text-lg font-bold text-white">{noneCount} вопросов</div>
              <div className="text-xs text-slate-400">
                Отсутствовали в лекциях — написаны с нуля и добавлены в Obsidian
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
