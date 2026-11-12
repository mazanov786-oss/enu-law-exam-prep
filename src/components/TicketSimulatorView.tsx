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
  Scale,
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
  const [showCaseSolution, setShowCaseSolution] = useState<boolean>(false);
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
      setShowCaseSolution(false);
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

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!questions) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400 text-sm">
        Формирование экзаменационного билета...
      </div>
    );
  }

  const currentQuestion = questions[activeIdx];
  const currentAnswer = answers[activeIdx];
  const currentEval = evaluations[activeIdx];
  const currentAi = aiResult[activeIdx];

  const handleEvaluateCurrent = () => {
    if (isListening) stopListening();

    const result = evaluateOralAnswer(currentAnswer, currentQuestion);
    setEvaluations((prev) => {
      const next = [...prev] as [
        OralEvaluationResult | null,
        OralEvaluationResult | null,
        OralEvaluationResult | null
      ];
      next[activeIdx] = result;
      return next;
    });

    onRecordQuestionScore(currentQuestion.id, result.score);

    // If score is weak or articles missed, log into Error Journal
    if (result.score < 70 || result.missedArticles.length > 0) {
      onAddError({
        questionId: currentQuestion.id,
        subject: currentQuestion.subject,
        source: "ticket",
        prompt: `Устный ответ на билетный вопрос №${currentQuestion.n}: ${currentQuestion.text}`,
        userAnswer: currentAnswer || "(ответ не был дан или не содержал ключевых норм)",
        expectedAnswer: currentQuestion.answer,
        explanation: result.feedbackSummary,
        missedArticles: result.missedArticles,
        missedKeywords: result.missedKeywords,
      });
    }
  };

  const handleSelfGrade = (score: number) => {
    const result = evaluateOralAnswer(currentAnswer, currentQuestion);
    result.score = score;
    result.grade = getEnuGrade(score);
    setEvaluations((prev) => {
      const next = [...prev] as [
        OralEvaluationResult | null,
        OralEvaluationResult | null,
        OralEvaluationResult | null
      ];
      next[activeIdx] = result;
      return next;
    });
    onRecordQuestionScore(currentQuestion.id, score);
  };

  const handleRunAiExaminer = async () => {
    if (!state.deadlines.geminiApiKey || !currentAnswer.trim()) return;
    setAiLoading(true);
    try {
      const prompt = `Ты строгий профессор юридического факультета ЕНУ им. Л. Н. Гумилева. Экзамен по дисциплине «${
        activeSubject === "up" ? "Уголовное право РК (Общая часть)" : "Гражданское право РК (Общая часть)"
      }».
Вопрос билета: «${currentQuestion.text}».
Нормативная база (статьи кодекса РК): ${currentQuestion.articles.join(", ")}.
Ключевые понятия: ${currentQuestion.keywords.join(", ")}.

Ответ студента (распознанный голос):
"""
${currentAnswer}
"""

Проанализируй ответ и верни СТРОГО JSON следующего формата:
{
  "examinerComment": "Краткий отзыв (2-3 предложения) на устный ответ",
  "mistakes": ["ошибка 1", "ошибка 2"],
  "followupQuestion": "Сложный дополнительный вопрос на знание статей УК/ГК РК или квалификационный казус"
}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.deadlines.geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );
      const json = await res.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        setAiResult((prev) => ({ ...prev, [activeIdx]: parsed }));
      }
    } catch (e: any) {
      setAiResult((prev) => ({
        ...prev,
        [activeIdx]: {
          error: "Не удалось получить вердикт ИИ. Проверьте Gemini API ключ.",
        },
      }));
    } finally {
      setAiLoading(false);
    }
  };

  const handleFinishTicket = () => {
    if (isListening) stopListening();
    setTimerRunning(false);

    // Compute automatic evaluations for un-evaluated questions
    const finalScores: [number, number, number] = [0, 0, 0];
    const finalEvals = [...evaluations] as typeof evaluations;

    for (let i = 0; i < 3; i++) {
      if (!finalEvals[i]) {
        const ev = evaluateOralAnswer(answers[i], questions[i]);
        finalEvals[i] = ev;
        onRecordQuestionScore(questions[i].id, ev.score);
      }
      finalScores[i] = finalEvals[i]!.score;
    }
    setEvaluations(finalEvals);

    const avg = Math.round(
      (finalScores[0] + finalScores[1] + finalScores[2]) / 3
    );
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
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 lg:flex-row lg:items-center lg:justify-between shadow-lg">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-indigo-500/20 border border-indigo-500/40 px-3 py-1 text-xs sm:text-sm font-extrabold text-indigo-300">
              ЭКЗАМЕНАЦИОННЫЙ БИЛЕТ № {ticketNumber}
            </span>
            <span className="text-xs sm:text-sm text-slate-400">
              Устный формат ЕНУ им. Л. Н. Гумилева • 3 вопроса + практический казус
            </span>
          </div>
          <h2 className="mt-1.5 text-xl sm:text-2xl font-black text-white">
            {db.subjects[activeSubject].title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Subject Switcher */}
          <div className="inline-flex rounded-xl border border-slate-700 bg-slate-950 p-1">
            <button
              onClick={() => onSelectSubject("up")}
              className={`rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-bold transition ${
                activeSubject === "up"
                  ? "bg-rose-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              УП РК (135)
            </button>
            <button
              onClick={() => onSelectSubject("gp")}
              className={`rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-bold transition ${
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
            className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="smart">Умный подбор (приоритет неизученных)</option>
            <option value="random">Чистый рандом (как на экзамене)</option>
            <option value="weak">Слабые места и ошибки</option>
          </select>

          {/* Timer */}
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs sm:text-sm font-mono font-bold text-slate-200">
            <Clock className="h-4 w-4 text-indigo-400" />
            <span>{formatTime(elapsedSec)}</span>
          </div>

          {/* New Ticket Button */}
          <button
            onClick={() => drawNewTicket(activeSubject, ticketMode)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-indigo-500 transition shadow-sm"
          >
            <Shuffle className="h-4 w-4" />
            <span>Новый билет</span>
          </button>
        </div>
      </div>

      {/* Ticket Summary Banner when finished */}
      {ticketFinished && (
        <div className="rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider text-indigo-300">
                <Award className="h-5 w-5" />
                <span>Итог сдачи экзаменационного билета №{ticketNumber}</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                Итоговая оценка: {ticketGrade.letter} ({ticketGrade.traditional}) — {ticketAverage}%
              </h3>
              <p className="text-sm sm:text-base text-slate-300">{ticketGrade.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`rounded-2xl border px-6 py-4 text-center ${ticketGrade.color}`}>
                <div className="text-3xl sm:text-4xl font-black">{ticketGrade.letter}</div>
                <div className="text-xs sm:text-sm font-bold opacity-80">GPA {ticketGrade.gpa}</div>
              </div>
              <button
                onClick={() => drawNewTicket(activeSubject, ticketMode)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-500 transition shadow-lg"
              >
                <RotateCcw className="h-5 w-5" />
                Следующий билет
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3 Ticket Questions Selector Tabs */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
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
                setShowCaseSolution(false);
              }}
              className={`flex flex-col justify-between rounded-2xl border p-5 text-left transition-all ${
                isSelected
                  ? "border-indigo-500 bg-slate-900 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/50"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-slate-800 px-2.5 py-1 text-xs sm:text-sm font-extrabold text-indigo-300">
                    Вопрос {idx + 1} билета (№{q.n})
                  </span>
                  {ev ? (
                    <span className={`rounded-md border px-2.5 py-0.5 text-xs sm:text-sm font-bold ${ev.grade.color}`}>
                      {ev.grade.letter} ({ev.score}%)
                    </span>
                  ) : answers[idx].trim() ? (
                    <span className="text-xs sm:text-sm font-semibold text-amber-400">Черновик готов</span>
                  ) : (
                    <span className="text-xs sm:text-sm text-slate-500">Ожидает ответа</span>
                  )}
                </div>
                <div className="mt-2.5 font-bold text-base sm:text-lg text-white line-clamp-2 leading-snug">
                  {q.text}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs sm:text-sm text-slate-400 pt-2.5 border-t border-slate-800/80">
                <span className="font-semibold">Модуль {q.module}</span>
                <span className="truncate max-w-[200px] text-indigo-300 font-mono">
                  {q.articles.slice(0, 2).join(", ")}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Question Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Question, Practical Case, Voice Input & Answer Editor */}
        <div className="lg:col-span-7 space-y-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 sm:p-7 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-indigo-400 font-bold">
                <span>Вопрос {activeIdx + 1} из 3</span>
                <span>•</span>
                <span>Модуль {currentQuestion.module}</span>
                <span>•</span>
                <span>Конспект: {currentQuestion.notes.join(", ")}</span>
              </div>
              <h3 className="mt-2 text-xl sm:text-2xl font-black text-white leading-snug">
                {currentQuestion.n}. {currentQuestion.text}
              </h3>
            </div>

            <button
              onClick={() => setShowPlanHint(!showPlanHint)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              <HelpCircle className="h-4 w-4 text-amber-400" />
              <span>{showPlanHint ? "Скрыть план" : "План ответа"}</span>
            </button>
          </div>

          {showPlanHint && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm sm:text-base space-y-2">
              <div className="font-black text-amber-300">
                Рекомендуемый план устного ответа на экзамене ЕНУ:
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-100">
                {currentQuestion.plan.map((pt, i) => (
                  <li key={i}>{pt.replace(/^\d+\.\s*/, "")}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Practical Case Study Block */}
          {currentQuestion.caseStudy && (
            <div className="rounded-2xl border border-indigo-500/30 bg-slate-950/70 p-5 space-y-3 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm sm:text-base font-black text-indigo-300">
                  <Scale className="h-5 w-5 text-indigo-400" />
                  <span>⚡ Практический казус к вопросу: {currentQuestion.caseStudy.caseTitle}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCaseSolution(!showCaseSolution)}
                  className="rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-xs sm:text-sm font-bold text-indigo-200 hover:bg-indigo-500/25 transition"
                >
                  {showCaseSolution ? "Скрыть решение казуса" : "Показать решение казуса"}
                </button>
              </div>

              <div className="text-sm sm:text-base text-slate-200 leading-relaxed bg-slate-900/90 rounded-xl p-4 sm:p-5 border border-slate-800/80">
                <strong className="text-white block mb-1.5 font-bold">Фабула дела (ситуационная задача):</strong>
                {currentQuestion.caseStudy.facts}
                <div className="mt-3 pt-2.5 border-t border-slate-800 text-amber-300 font-bold">
                  Вопрос экзаменатора: {currentQuestion.caseStudy.question}
                </div>
              </div>

              {showCaseSolution && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 sm:p-5 space-y-2.5 text-sm sm:text-base">
                  <strong className="text-emerald-300 block font-black">
                    Юридический анализ и квалификация казуса:
                  </strong>
                  <div className="whitespace-pre-line leading-relaxed text-slate-100">
                    {currentQuestion.caseStudy.solution}
                  </div>
                  <div className="pt-2 text-xs sm:text-sm font-mono text-emerald-400 font-bold">
                    Нормативная база: {currentQuestion.caseStudy.articles.join(", ")}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Voice Recording Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleListening}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs sm:text-sm font-black transition shadow-md ${
                  isListening
                    ? "bg-rose-600 text-white animate-pulse shadow-rose-500/30"
                    : "bg-indigo-600 text-white hover:bg-indigo-500"
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-5 w-5" />
                    <span>Остановить запись</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    <span>Отвечать голосом (RU)</span>
                  </>
                )}
              </button>
              <div className="text-xs sm:text-sm text-slate-300">
                {isListening ? (
                  <span className="text-rose-400 font-bold">
                    Идет распознавание речи... Говорите как на устном экзамене.
                  </span>
                ) : isSupported ? (
                  <span>Нажмите микрофон для ответа или вводите тезисы ниже</span>
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
                className="text-xs sm:text-sm text-slate-400 hover:text-rose-400 font-medium"
              >
                Очистить текст
              </button>
            )}
          </div>

          {speechError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs sm:text-sm text-rose-300 font-medium">
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
              placeholder="Отвечайте устно через микрофон или введите ключевые тезисы: определение, статьи УК/ГК РК, классификация, решение задачи..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-4 sm:p-5 text-base sm:text-lg text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none leading-relaxed font-normal"
            />
            {interimText && (
              <div className="mt-1 rounded-lg bg-indigo-950/70 border border-indigo-500/30 px-3.5 py-2 text-xs sm:text-sm italic text-indigo-200">
                Распознается: «{interimText}...»
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleEvaluateCurrent}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs sm:text-sm font-black text-white hover:bg-emerald-500 transition shadow-lg"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Проверить ответ и сверить с эталоном</span>
              </button>

              {state.deadlines.geminiApiKey && (
                <button
                  type="button"
                  disabled={aiLoading || !currentAnswer.trim()}
                  onClick={handleRunAiExaminer}
                  className="inline-flex items-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/15 px-4 py-3 text-xs sm:text-sm font-bold text-purple-200 hover:bg-purple-500/25 disabled:opacity-50 transition"
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
                    setShowCaseSolution(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-xs sm:text-sm font-bold text-slate-200 hover:bg-slate-700"
                >
                  <span>К вопросу {activeIdx + 2}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishTicket}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs sm:text-sm font-black text-white hover:bg-indigo-500 shadow-xl"
                >
                  <Award className="h-4 w-4" />
                  <span>Завершить билет (Итог)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Evaluation, Reference Answer, Traps & Examiner Follow-ups */}
        <div className="lg:col-span-5 space-y-4">
          {!currentEval ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 text-center space-y-4">
              <BookOpen className="mx-auto h-12 w-12 text-slate-500" />
              <h4 className="text-base sm:text-lg font-black text-white">
                Эталонный ответ, статьи и доп. вопросы скрыты во время ответа
              </h4>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Сначала сформулируйте ответ голосом или письменно и нажмите{" "}
                <strong className="text-white">«Проверить ответ и сверить с эталоном»</strong>. Система проверит названные вами статьи УК/ГК РК, ключевые понятия, покажет ловушки экзаменатора и выставит оценку по шкале ЕНУ.
              </p>
              <button
                onClick={handleEvaluateCurrent}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-300 hover:text-white"
              >
                Показать эталонный ответ сразу (режим чтения)
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Score & Keyword/Article Radar */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-semibold text-slate-400">
                      Оценка за вопрос №{currentQuestion.n}
                    </div>
                    <div className="text-lg sm:text-xl font-black text-white">
                      {currentEval.grade.traditional} ({currentEval.score}%)
                    </div>
                  </div>
                  <div className={`rounded-xl border px-4 py-2 text-xl font-black ${currentEval.grade.color}`}>
                    {currentEval.grade.letter}
                  </div>
                </div>

                <p className="text-sm sm:text-base text-slate-200 leading-relaxed">{currentEval.feedbackSummary}</p>

                {/* Articles Check */}
                <div className="space-y-2">
                  <div className="text-xs sm:text-sm font-bold text-slate-300">
                    Нормативная база (Статьи НПА РК):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentQuestion.articles.map((art, i) => {
                      const hit = currentEval.matchedArticles.includes(art);
                      return (
                        <span
                          key={i}
                          className={`rounded-md border px-2.5 py-1 text-xs sm:text-sm font-bold ${
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
                <div className="space-y-2">
                  <div className="text-xs sm:text-sm font-bold text-slate-300">
                    Ключевые понятия ({currentEval.matchedKeywords.length}/
                    {currentQuestion.keywords.length}):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentQuestion.keywords.map((kw, i) => {
                      const hit = currentEval.matchedKeywords.includes(kw);
                      return (
                        <span
                          key={i}
                          className={`rounded-md border px-2.5 py-0.5 text-xs sm:text-sm ${
                            hit
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-semibold"
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
                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-medium text-slate-400">Самооценка:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleSelfGrade(95)}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs sm:text-sm font-bold text-emerald-300 hover:bg-emerald-500/20"
                    >
                      Отлично (A)
                    </button>
                    <button
                      onClick={() => handleSelfGrade(80)}
                      className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs sm:text-sm font-bold text-sky-300 hover:bg-sky-500/20"
                    >
                      Хорошо (B)
                    </button>
                    <button
                      onClick={() => handleSelfGrade(55)}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs sm:text-sm font-bold text-amber-300 hover:bg-amber-500/20"
                    >
                      Повторить (D)
                    </button>
                  </div>
                </div>
              </div>

              {/* Optional AI Examiner Feedback */}
              {currentAi && (
                <div className="rounded-2xl border border-purple-500/40 bg-purple-950/20 p-5 space-y-2.5 text-sm">
                  <div className="font-black text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    <span>Вердикт ИИ-экзаменатора ЕНУ</span>
                  </div>
                  {currentAi.error ? (
                    <div className="text-rose-300">{currentAi.error}</div>
                  ) : (
                    <>
                      <p className="text-slate-200 leading-relaxed">{currentAi.examinerComment}</p>
                      {currentAi.mistakes?.length > 0 && (
                        <div>
                          <span className="font-bold text-rose-300">Неточности: </span>
                          <span className="text-slate-300">{currentAi.mistakes.join("; ")}</span>
                        </div>
                      )}
                      {currentAi.followupQuestion && (
                        <div className="rounded-lg bg-purple-950/50 p-3 border border-purple-500/30 text-purple-200">
                          <strong>Вопрос на засыпку:</strong> {currentAi.followupQuestion}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Reference Answer & Plan */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6 space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm sm:text-base font-black text-indigo-300">
                    Образцовый устный ответ на экзамене
                  </h4>
                  <button
                    onClick={() => speakText(currentQuestion.answer)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs sm:text-sm text-slate-300 hover:text-white"
                    title="Озвучить ответ"
                  >
                    <Volume2 className="h-4 w-4" />
                    <span>Слушать</span>
                  </button>
                </div>
                <div className="text-base sm:text-lg text-slate-100 whitespace-pre-line leading-relaxed font-normal">
                  {currentQuestion.answer}
                </div>
              </div>

              {/* Examiner Traps & Follow-up Questions */}
              <div className="rounded-2xl border border-amber-500/30 bg-amber-950/15 p-5 space-y-3.5 shadow-md">
                <div>
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Ловушки квалификации (на чем валят на экзамене):</span>
                  </div>
                  <ul className="mt-2 list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-100 leading-relaxed">
                    {currentQuestion.traps.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-amber-500/20">
                  <div className="text-xs sm:text-sm font-black text-indigo-300">
                    Дополнительные вопросы экзаменатора по билету:
                  </div>
                  <ul className="mt-2 list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-slate-100 leading-relaxed">
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
