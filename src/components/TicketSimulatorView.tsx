"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ErrorRecord,
  ExamDatabase,
  ExamQuestion,
  SubjectId,
  TicketHistoryItem,
  UserStudyState,
} from "@/types/exam";
import {
  evaluateOralAnswer,
  generateExamTicket,
  getEnuGrade,
  OralEvaluationResult,
} from "@/lib/evaluator";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import {
  Mic,
  MicOff,
  Shuffle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  BookOpen,
  HelpCircle,
  Award,
  RotateCcw,
  ChevronRight,
  Brain,
  Volume2,
} from "lucide-react";

interface TicketSimulatorViewProps {
  db: ExamDatabase;
  state: UserStudyState;
  activeSubject: SubjectId;
  onSelectSubject: (s: SubjectId) => void;
  onRecordQuestionScore: (questionId: string, score: number) => void;
  onAddError: (err: Omit<ErrorRecord, "id" | "timestamp" | "resolved">) => void;
  onSaveTicketHistory: (ticket: TicketHistoryItem) => void;
}

export default function TicketSimulatorView({
  db,
  state,
  activeSubject,
  onSelectSubject,
  onRecordQuestionScore,
  onAddError,
  onSaveTicketHistory,
}: TicketSimulatorViewProps) {
  const [ticketMode, setTicketMode] = useState<"smart" | "random" | "weak">("smart");
  const [ticketNumber, setTicketNumber] = useState<number>(1);
  const [questions, setQuestions] = useState<[ExamQuestion, ExamQuestion, ExamQuestion] | null>(
    null
  );
  const [activeIdx, setActiveIdx] = useState<0 | 1 | 2>(0);
  const [answers, setAnswers] = useState<[string, string, string]>(["", "", ""]);
  const [evaluations, setEvaluations] = useState<
    [OralEvaluationResult | null, OralEvaluationResult | null, OralEvaluationResult | null]
  >([null, null, null]);
  const [aiResult, setAiResult] = useState<Record<number, any>>({});
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [showPlanHint, setShowPlanHint] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(true);
  const [ticketFinished, setTicketFinished] = useState<boolean>(false);

  const drawNewTicket = useCallback(
    (subj: SubjectId = activeSubject, mode: "smart" | "random" | "weak" = ticketMode) => {
      const drawn = generateExamTicket(db.questions, subj, state.progress, mode);
      setQuestions(drawn);
      setActiveIdx(0);
      setAnswers(["", "", ""]);
      setEvaluations([null, null, null]);
      setAiResult({});
      setShowPlanHint(false);
      setElapsedSec(0);
      setTimerRunning(true);
      setTicketFinished(false);
      setTicketNumber(Math.floor(Math.random() * 35) + 1);
    },
    [db.questions, activeSubject, state.progress, ticketMode]
  );

  useEffect(() => {
    drawNewTicket(activeSubject, ticketMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubject]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const handleVoiceChunk = useCallback(
    (chunk: string) => {
      setAnswers((prev) => {
        const next: [string, string, string] = [...prev] as [string, string, string];
        const curr = next[activeIdx];
        next[activeIdx] = curr ? `${curr.trim()} ${chunk}` : chunk;
        return next;
      });
    },
    [activeIdx]
  );

  const {
    isListening,
    isSupported,
    interimText,
    error: speechError,
    stopListening,
    toggleListening,
  } = useSpeechRecognition(handleVoiceChunk);

  if (!questions) return null;

  const currentQuestion = questions[activeIdx];
  const currentAnswer = answers[activeIdx];
  const currentEval = evaluations[activeIdx];
  const currentAi = aiResult[activeIdx];

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleEvaluateCurrent = async () => {
    if (isListening) stopListening();
    const res = evaluateOralAnswer(currentAnswer, currentQuestion);
    const nextEvals: [
      OralEvaluationResult | null,
      OralEvaluationResult | null,
      OralEvaluationResult | null
    ] = [...evaluations] as any;
    nextEvals[activeIdx] = res;
    setEvaluations(nextEvals);

    onRecordQuestionScore(currentQuestion.id, res.score);

    // Log to error journal if score < 75 or missed important articles
    if (res.score < 75 || res.missedArticles.length > 0) {
      onAddError({
        questionId: currentQuestion.id,
        subject: currentQuestion.subject,
        source: "ticket",
        prompt: `Устный ответ по билету: Вопрос №${currentQuestion.n}. ${currentQuestion.text}`,
        userAnswer: currentAnswer || "(Ответ не дан)",
        expectedAnswer: currentQuestion.answer,
        explanation: `Оценка ответа: ${res.grade.letter} (${res.score}%). Не упомянуты статьи: ${
          res.missedArticles.join(", ") || "нет"
        }. Пропущены понятия: ${res.missedKeywords.slice(0, 5).join(", ")}.`,
        missedArticles: res.missedArticles,
        missedKeywords: res.missedKeywords,
      });
    }
  };

  const handleRunAiExaminer = async () => {
    if (!currentAnswer.trim()) return;
    setAiLoading(true);
    try {
      const resp = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: currentQuestion.text,
          referenceAnswer: currentQuestion.answer,
          articles: currentQuestion.articles,
          plan: currentQuestion.plan,
          userAnswer: currentAnswer,
          apiKey: state.deadlines.geminiApiKey,
        }),
      });
      const data = await resp.json();
      setAiResult((prev) => ({ ...prev, [activeIdx]: data }));
      if (typeof data.score === "number") {
        onRecordQuestionScore(currentQuestion.id, data.score);
      }
    } catch (e: any) {
      setAiResult((prev) => ({
        ...prev,
        [activeIdx]: { error: e?.message || "Ошибка соединения" },
      }));
    } finally {
      setAiLoading(false);
    }
  };

  const handleSelfGrade = (overrideScore: number) => {
    const baseEval = currentEval || evaluateOralAnswer(currentAnswer, currentQuestion);
    const updated: OralEvaluationResult = {
      ...baseEval,
      score: overrideScore,
      grade: getEnuGrade(overrideScore),
    };
    const nextEvals: [
      OralEvaluationResult | null,
      OralEvaluationResult | null,
      OralEvaluationResult | null
    ] = [...evaluations] as any;
    nextEvals[activeIdx] = updated;
    setEvaluations(nextEvals);
    onRecordQuestionScore(currentQuestion.id, overrideScore);
  };

  const handleFinishTicket = () => {
    if (isListening) stopListening();
    setTimerRunning(false);

    // Ensure all 3 questions have an evaluation
    const finalScores: [number, number, number] = [0, 0, 0];
    const nextEvals: [
      OralEvaluationResult | null,
      OralEvaluationResult | null,
      OralEvaluationResult | null
    ] = [...evaluations] as any;

    for (let i = 0; i < 3; i++) {
      if (!nextEvals[i]) {
        const ev = evaluateOralAnswer(answers[i], questions[i]);
        nextEvals[i] = ev;
        onRecordQuestionScore(questions[i].id, ev.score);
      }
      finalScores[i] = nextEvals[i]!.score;
    }

    setEvaluations(nextEvals);
    const avg = Math.round((finalScores[0] + finalScores[1] + finalScores[2]) / 3);
    const grade = getEnuGrade(avg);

    onSaveTicketHistory({
      id: `ticket-${Date.now()}`,
      subject: activeSubject,
      timestamp: new Date().toISOString(),
      questionIds: [questions[0].id, questions[1].id, questions[2].id],
      scores: finalScores,
      averageScore: avg,
      enuGrade: grade.letter,
      durationSec: elapsedSec,
    });

    setTicketFinished(true);
  };

  const speakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/\*\*/g, "");
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = "ru-RU";
    utter.rate = 1.05;
    window.speechSynthesis.speak(utter);
  };

  const allThreeScores = evaluations.map((e) => (e ? e.score : 0));
  const ticketAverage = Math.round(
    (allThreeScores[0] + allThreeScores[1] + allThreeScores[2]) / 3
  );
  const ticketGrade = getEnuGrade(ticketAverage);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-indigo-500/20 border border-indigo-500/40 px-2.5 py-0.5 text-xs font-bold text-indigo-300">
              ЭКЗАМЕНАЦИОННЫЙ БИЛЕТ № {ticketNumber}
            </span>
            <span className="text-xs text-slate-400">
              Устный формат ЕНУ • 3 вопроса из разных разделов силлабуса
            </span>
          </div>
          <h2 className="mt-1.5 text-xl font-bold text-white">
            {db.subjects[activeSubject].title}
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
              УП РК (135)
            </button>
            <button
              onClick={() => onSelectSubject("gp")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeSubject === "gp"
                  ? "bg-sky-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ГП РК (73)
            </button>
          </div>

          {/* Mode Selector */}
          <select
            value={ticketMode}
            onChange={(e) => {
              const m = e.target.value as "smart" | "random" | "weak";
              setTicketMode(m);
              drawNewTicket(activeSubject, m);
            }}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="smart">Умный подбор (приоритет неизученных)</option>
            <option value="random">Чистый рандом (как на экзамене)</option>
            <option value="weak">Слабые места и ошибки</option>
          </select>

          {/* Timer */}
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-200">
            <Clock className="h-3.5 w-3.5 text-indigo-400" />
            <span>{formatTime(elapsedSec)}</span>
          </div>

          {/* New Ticket Button */}
          <button
            onClick={() => drawNewTicket(activeSubject, ticketMode)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-sm"
          >
            <Shuffle className="h-3.5 w-3.5" />
            <span>Тянуть новый билет</span>
          </button>
        </div>
      </div>

      {/* Ticket Summary Banner when finished */}
      {ticketFinished && (
        <div className="rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 p-6 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
                <Award className="h-4 w-4" />
                <span>Итог сдачи экзаменационного билета №{ticketNumber}</span>
              </div>
              <h3 className="text-2xl font-bold text-white">
                Итоговая оценка: {ticketGrade.letter} ({ticketGrade.traditional}) — {ticketAverage}%
              </h3>
              <p className="text-sm text-slate-300">{ticketGrade.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`rounded-2xl border px-5 py-3 text-center ${ticketGrade.color}`}>
                <div className="text-3xl font-extrabold">{ticketGrade.letter}</div>
                <div className="text-xs opacity-80">GPA {ticketGrade.gpa}</div>
              </div>
              <button
                onClick={() => drawNewTicket(activeSubject, ticketMode)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white hover:bg-indigo-500 transition"
              >
                <RotateCcw className="h-4 w-4" />
                Следующий билет
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3 Ticket Questions Selector Tabs */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {questions.map((q, idx) => {
          const ev = evaluations[idx];
          const isSelected = activeIdx === idx;
          return (
            <button
              key={q.id}
              onClick={() => {
                if (isListening) stopListening();
                setActiveIdx(idx as 0 | 1 | 2);
                setShowPlanHint(false);
              }}
              className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-indigo-500 bg-slate-900 shadow-lg shadow-indigo-500/10"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold text-indigo-300">
                    Вопрос {idx + 1} билета (№{q.n} в УМК)
                  </span>
                  {ev ? (
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-bold ${ev.grade.color}`}>
                      {ev.grade.letter} ({ev.score}%)
                    </span>
                  ) : answers[idx].trim() ? (
                    <span className="text-xs text-amber-400">Черновик готов</span>
                  ) : (
                    <span className="text-xs text-slate-500">Ожидает ответа</span>
                  )}
                </div>
                <div className="mt-2 font-semibold text-sm text-white line-clamp-2">
                  {q.text}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                <span>Модуль {q.module}</span>
                <span className="truncate max-w-[180px]">
                  {q.articles.slice(0, 2).join(", ")}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Question Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Question, Voice Input & Answer Editor */}
        <div className="lg:col-span-7 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold">
                <span>Вопрос {activeIdx + 1} из 3</span>
                <span>•</span>
                <span>Модуль {currentQuestion.module}</span>
                <span>•</span>
                <span>Конспект: {currentQuestion.notes.join(", ")}</span>
              </div>
              <h3 className="mt-1 text-lg sm:text-xl font-bold text-white">
                {currentQuestion.n}. {currentQuestion.text}
              </h3>
            </div>

            <button
              onClick={() => setShowPlanHint(!showPlanHint)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              <HelpCircle className="h-3.5 w-3.5 text-amber-400" />
              <span>{showPlanHint ? "Скрыть план-подсказку" : "Подсказка: план ответа"}</span>
            </button>
          </div>

          {showPlanHint && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs space-y-1.5">
              <div className="font-bold text-amber-300">
                Рекомендуемый план устного ответа (без раскрытия деталей):
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-200">
                {currentQuestion.plan.map((pt, i) => (
                  <li key={i}>{pt.replace(/^\d+\.\s*/, "")}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Voice Recording Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleListening}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-md ${
                  isListening
                    ? "bg-rose-600 text-white animate-pulse shadow-rose-500/30"
                    : "bg-indigo-600 text-white hover:bg-indigo-500"
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-4 w-4" />
                    <span>Остановить запись голоса</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    <span>Отвечать голосом (RU)</span>
                  </>
                )}
              </button>
              <div className="text-xs text-slate-400">
                {isListening ? (
                  <span className="text-rose-400 font-medium">
                    Идет распознавание речи... Говорите как на устном экзамене.
                  </span>
                ) : isSupported ? (
                  <span>Нажмите микрофон для устного ответа или печатайте тезисы ниже</span>
                ) : (
                  <span className="text-amber-400">
                    Для голосового ввода используйте Chrome или Edge
                  </span>
                )}
              </div>
            </div>
            {currentAnswer && (
              <button
                type="button"
                onClick={() => {
                  const next: [string, string, string] = [...answers] as any;
                  next[activeIdx] = "";
                  setAnswers(next);
                }}
                className="text-xs text-slate-400 hover:text-rose-400"
              >
                Очистить текст
              </button>
            )}
          </div>

          {speechError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {speechError}
            </div>
          )}

          {/* Live Transcript & Textarea */}
          <div className="relative">
            <textarea
              rows={8}
              value={currentAnswer}
              onChange={(e) => {
                const next: [string, string, string] = [...answers] as any;
                next[activeIdx] = e.target.value;
                setAnswers(next);
              }}
              placeholder="Отвечайте устно через микрофон или введите основные тезисы: определение, признаки, номера статей УК/ГК РК, виды, примеры..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none leading-relaxed"
            />
            {interimText && (
              <div className="mt-1 rounded-lg bg-indigo-950/70 border border-indigo-500/30 px-3 py-1.5 text-xs italic text-indigo-200">
                Распознается: «{interimText}...»
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleEvaluateCurrent}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-md"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Проверить ответ и сверить с эталоном</span>
              </button>

              {state.deadlines.geminiApiKey && (
                <button
                  type="button"
                  disabled={aiLoading || !currentAnswer.trim()}
                  onClick={handleRunAiExaminer}
                  className="inline-flex items-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/15 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-500/25 disabled:opacity-50 transition"
                >
                  <Brain className="h-4 w-4" />
                  <span>{aiLoading ? "ИИ проверяет..." : "ИИ-экзаменатор (Gemini)"}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeIdx < 2 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (isListening) stopListening();
                    setActiveIdx((activeIdx + 1) as 0 | 1 | 2);
                    setShowPlanHint(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  <span>К вопросу {activeIdx + 2}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishTicket}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 shadow-lg"
                >
                  <Award className="h-4 w-4" />
                  <span>Завершить билет (Итог по 3 вопросам)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Evaluation, Reference Answer, Traps & Examiner Follow-ups */}
        <div className="lg:col-span-5 space-y-4">
          {!currentEval ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center space-y-3">
              <BookOpen className="mx-auto h-10 w-10 text-slate-500" />
              <h4 className="text-base font-bold text-white">
                Эталонный ответ, статьи и доп. вопросы скрыты во время ответа
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Сначала сформулируйте ответ голосом или письменно и нажмите{" "}
                <strong>«Проверить ответ и сверить с эталоном»</strong>. Система проверит названные вами статьи УК/ГК РК, ключевые понятия, покажет ловушки экзаменатора и выставит оценку по шкале ЕНУ.
              </p>
              <button
                onClick={handleEvaluateCurrent}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Показать эталонный ответ сразу (режим чтения)
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Score & Keyword/Article Radar */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Оценка за вопрос №{currentQuestion.n}</div>
                    <div className="text-lg font-bold text-white">
                      {currentEval.grade.traditional} ({currentEval.score}%)
                    </div>
                  </div>
                  <div className={`rounded-xl border px-3.5 py-1.5 text-lg font-extrabold ${currentEval.grade.color}`}>
                    {currentEval.grade.letter}
                  </div>
                </div>

                <p className="text-xs text-slate-300">{currentEval.feedbackSummary}</p>

                {/* Articles Check */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-300">
                    Нормативная база (Статьи НПА РК):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentQuestion.articles.map((art, i) => {
                      const hit = currentEval.matchedArticles.includes(art);
                      return (
                        <span
                          key={i}
                          className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
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

                {/* Keywords Check */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-300">
                    Ключевые юридические понятия ({currentEval.matchedKeywords.length}/
                    {currentQuestion.keywords.length}):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentQuestion.keywords.map((kw, i) => {
                      const hit = currentEval.matchedKeywords.includes(kw);
                      return (
                        <span
                          key={i}
                          className={`rounded-md border px-2 py-0.5 text-xs ${
                            hit
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
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

                {/* Self-Correction Grade Override */}
                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">Самооценка после сверки:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleSelfGrade(95)}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
                    >
                      Знаю отлично (A)
                    </button>
                    <button
                      onClick={() => handleSelfGrade(80)}
                      className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300 hover:bg-sky-500/20"
                    >
                      Хорошо (B)
                    </button>
                    <button
                      onClick={() => handleSelfGrade(55)}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
                    >
                      Повторить (D)
                    </button>
                  </div>
                </div>
              </div>

              {/* Optional AI Examiner Feedback */}
              {currentAi && (
                <div className="rounded-2xl border border-purple-500/40 bg-purple-950/20 p-4 space-y-2 text-xs">
                  <div className="font-bold text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    <span>Вердикт ИИ-экзаменатора ЕНУ</span>
                  </div>
                  {currentAi.error ? (
                    <div className="text-rose-300">{currentAi.error}</div>
                  ) : (
                    <>
                      <p className="text-slate-200">{currentAi.examinerComment}</p>
                      {currentAi.mistakes?.length > 0 && (
                        <div>
                          <span className="font-semibold text-rose-300">Неточности: </span>
                          <span className="text-slate-300">{currentAi.mistakes.join("; ")}</span>
                        </div>
                      )}
                      {currentAi.followupQuestion && (
                        <div className="rounded-lg bg-purple-950/50 p-2.5 border border-purple-500/30 text-purple-200">
                          <strong>Вопрос на засыпку:</strong> {currentAi.followupQuestion}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Reference Answer & Plan */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-indigo-300">
                    Образцовый устный ответ на экзамене
                  </h4>
                  <button
                    onClick={() => speakText(currentQuestion.answer)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:text-white"
                    title="Озвучить ответ"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>Слушать</span>
                  </button>
                </div>
                <div className="text-xs sm:text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                  {currentQuestion.answer}
                </div>
              </div>

              {/* Examiner Traps & Follow-up Questions */}
              <div className="rounded-2xl border border-amber-500/30 bg-amber-950/15 p-4 space-y-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Ловушки квалификации (на чем валят на экзамене):</span>
                  </div>
                  <ul className="mt-1.5 list-disc list-inside space-y-1 text-xs text-slate-200">
                    {currentQuestion.traps.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 border-t border-amber-500/20">
                  <div className="text-xs font-bold text-indigo-300">
                    Дополнительные вопросы экзаменатора по билету:
                  </div>
                  <ul className="mt-1.5 list-decimal list-inside space-y-1 text-xs text-slate-200">
                    {currentQuestion.followups.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
