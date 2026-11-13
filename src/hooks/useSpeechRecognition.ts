"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface SpeechRecognitionHook {
  isListening: boolean;
  isSupported: boolean;
  isTranscribing: boolean;
  mode: "speech" | "audio";
  interimText: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

interface UseSpeechRecognitionOptions {
  geminiApiKey?: string;
}

function formatLegalTranscript(raw: string): string {
  return raw
    .replace(/\bстатья\s+(\d+)/gi, "ст. $1")
    .replace(/\bстатьи\s+(\d+)/gi, "ст. $1")
    .replace(/\bук\s+рк\b/gi, "УК РК")
    .replace(/\bгк\s+рк\b/gi, "ГК РК")
    .replace(/\bкоап\s+рк\b/gi, "КоАП РК")
    .replace(/\bупк\s+рк\b/gi, "УПК РК")
    .replace(/\bгпк\s+рк\b/gi, "ГПК РК")
    .replace(/\bаппк\s+рк\b/gi, "АППК РК")
    .replace(/\bвс\s+рк\b/gi, "ВС РК")
    .trim();
}

function getSpeechConstructor(): any {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

function hasAudioRecordingSupport(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

export function useSpeechRecognition(
  onFinalTranscript: (text: string) => void,
  options?: UseSpeechRecognitionOptions
): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [mode, setMode] = useState<"speech" | "audio">("speech");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const callbackRef = useRef(onFinalTranscript);
  const geminiApiKeyRef = useRef(options?.geminiApiKey);

  const recognitionRef = useRef<any>(null);
  const shouldKeepListeningRef = useRef(false);
  const sessionIdRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interimRef = useRef("");
  const nextFinalIdxRef = useRef(0);
  const noSpeechStreakRef = useRef(0);

  // Fallback MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    callbackRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    geminiApiKeyRef.current = options?.geminiApiKey;
  }, [options?.geminiApiKey]);

  const flushInterimToCallback = useCallback(() => {
    const leftover = formatLegalTranscript(interimRef.current);
    interimRef.current = "";
    setInterimText("");
    if (leftover) {
      callbackRef.current(leftover);
    }
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const cleanupRecognitionInstance = useCallback(() => {
    clearRestartTimer();
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        try {
          rec.stop();
        } catch {}
      }
    }
  }, [clearRestartTimer]);

  const cleanupMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      mediaStreamRef.current = null;
    }
  }, []);

  const startAudioFallback = useCallback(async () => {
    const key = geminiApiKeyRef.current?.trim();
    if (!hasAudioRecordingSupport()) {
      setIsListening(false);
      setError(
        "Этот браузер не поддерживает запись с микрофона. Откройте сайт в Google Chrome или Microsoft Edge."
      );
      return;
    }
    if (!key) {
      setIsListening(false);
      setError(
        "Встроенный Web Speech API недоступен. Используйте Google Chrome / Microsoft Edge, либо добавьте Gemini API ключ в «Настройках» на Главной для резервной записи речи."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg",
      ];
      const mimeType = preferredTypes.find((t) =>
        typeof MediaRecorder.isTypeSupported === "function"
          ? MediaRecorder.isTypeSupported(t)
          : false
      );

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        cleanupMediaStream();
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;

        if (chunks.length === 0) {
          setIsListening(false);
          return;
        }

        const blob = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });

        setIsTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "voice-answer.webm");
          form.append("apiKey", key);

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: form,
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data?.error || "Не удалось расшифровать аудио.");
          } else if (data?.text?.trim()) {
            const formatted = formatLegalTranscript(data.text);
            if (formatted) {
              callbackRef.current(formatted);
            }
          } else {
            setError("Речь не распознана. Попробуйте говорить ближе к микрофону.");
          }
        } catch {
          setError("Ошибка сети при отправке аудио на расшифровку.");
        } finally {
          setIsTranscribing(false);
          setIsListening(false);
        }
      };

      mediaRecorderRef.current = recorder;
      setMode("audio");
      setError(null);
      setIsListening(true);
      recorder.start(500);
    } catch (err: any) {
      cleanupMediaStream();
      setIsListening(false);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setError(
          "Доступ к микрофону запрещен в браузере. Нажмите на значок замка/микрофона в адресной строке и разрешите доступ."
        );
      } else if (err?.name === "NotFoundError") {
        setError("Микрофон не найден. Проверьте подключение гарнитуры или микрофона.");
      } else {
        setError(`Не удалось запустить микрофон: ${err?.message || "неизвестная ошибка"}`);
      }
    }
  }, [cleanupMediaStream]);

  const startSpeechSession = useCallback(() => {
    const SpeechRecognition = getSpeechConstructor();
    if (!SpeechRecognition) {
      void startAudioFallback();
      return;
    }

    cleanupRecognitionInstance();
    const mySessionId = ++sessionIdRef.current;

    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    nextFinalIdxRef.current = 0;
    interimRef.current = "";

    recognition.onstart = () => {
      if (sessionIdRef.current !== mySessionId) return;
      setMode("speech");
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      if (sessionIdRef.current !== mySessionId) return;
      noSpeechStreakRef.current = 0;

      let interim = "";
      let finalChunk = "";
      const startIndex = Math.max(event.resultIndex || 0, nextFinalIdxRef.current);

      for (let i = startIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript || "";
        if (result?.isFinal) {
          finalChunk += transcript + " ";
          nextFinalIdxRef.current = i + 1;
        } else {
          interim += transcript;
        }
      }

      if (finalChunk.trim()) {
        const formatted = formatLegalTranscript(finalChunk);
        // Reset interim first so stopping right after a final chunk won't duplicate it
        interimRef.current = "";
        setInterimText("");
        if (formatted) {
          callbackRef.current(formatted);
        }
      }

      interimRef.current = interim;
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (sessionIdRef.current !== mySessionId) return;
      const code = event?.error as string;

      if (code === "aborted") {
        return;
      }

      if (code === "no-speech") {
        noSpeechStreakRef.current += 1;
        if (noSpeechStreakRef.current >= 3) {
          shouldKeepListeningRef.current = false;
          setError("Речь не обнаружена — проверьте выбранный микрофон в системе и нажмите кнопку снова.");
          setIsListening(false);
        }
        return;
      }

      // Fatal error: stop infinite restart loops immediately
      shouldKeepListeningRef.current = false;
      clearRestartTimer();

      if (code === "not-allowed") {
        setError(
          "Доступ к микрофону запрещен в браузере. Нажмите на значок замка/микрофона в адресной строке и разрешите микрофон."
        );
        setIsListening(false);
        return;
      }

      if (code === "audio-capture") {
        setError(
          "Микрофон не найден или занят другой программой. Проверьте настройки звука Windows / устройства."
        );
        setIsListening(false);
        return;
      }

      if (code === "network" || code === "service-not-allowed" || code === "language-not-supported") {
        cleanupRecognitionInstance();
        if (geminiApiKeyRef.current?.trim() && hasAudioRecordingSupport()) {
          // Seamless switch to MediaRecorder + Gemini audio transcription
          void startAudioFallback();
          return;
        }

        const reasonMap: Record<string, string> = {
          network:
            "Браузер не смог связаться с сервером распознавания речи (Speech API). Отключите блокировщик/VPN для Google или укажите Gemini API ключ на Главной (Настройки) для резервной записи микрофона.",
          "service-not-allowed":
            "Сервис распознавания речи заблокирован в этом браузере (Brave/Opera/Arc/инкогнито). Откройте сайт в Google Chrome или Microsoft Edge, либо добавьте Gemini API ключ в Настройках.",
          "language-not-supported":
            "Русский язык не поддерживается встроенным движком речи этого браузера. Используйте Google Chrome или Microsoft Edge.",
        };
        setError(reasonMap[code] || `Ошибка распознавания речи: ${code}`);
        setIsListening(false);
        return;
      }

      setError(`Ошибка распознавания речи: ${code}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      if (sessionIdRef.current !== mySessionId) return;

      // Never discard uncommitted spoken interim text when browser pauses/ends
      flushInterimToCallback();

      if (shouldKeepListeningRef.current) {
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          if (shouldKeepListeningRef.current && sessionIdRef.current === mySessionId) {
            startSpeechSession();
          }
        }, 180);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (err: any) {
      cleanupRecognitionInstance();
      shouldKeepListeningRef.current = false;
      setIsListening(false);
      setError(
        `Не удалось запустить распознавание речи: ${err?.message || "повторите попытку"}`
      );
    }
  }, [
    cleanupRecognitionInstance,
    clearRestartTimer,
    flushInterimToCallback,
    startAudioFallback,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported = Boolean(getSpeechConstructor() || hasAudioRecordingSupport());
    setIsSupported(supported);

    return () => {
      shouldKeepListeningRef.current = false;
      sessionIdRef.current += 1;
      cleanupRecognitionInstance();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      cleanupMediaStream();
    };
  }, [cleanupRecognitionInstance, cleanupMediaStream]);

  const startListening = useCallback(() => {
    setError(null);
    noSpeechStreakRef.current = 0;

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError("Голосовой ввод работает только по HTTPS или localhost.");
      return;
    }

    const SpeechRecognition = getSpeechConstructor();
    if (!SpeechRecognition) {
      void startAudioFallback();
      return;
    }

    shouldKeepListeningRef.current = true;
    startSpeechSession();
  }, [startAudioFallback, startSpeechSession]);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    clearRestartTimer();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        cleanupMediaStream();
        setIsListening(false);
      }
      return;
    }

    // Commit any spoken interim text before stopping session
    flushInterimToCallback();
    sessionIdRef.current += 1;
    cleanupRecognitionInstance();
    setIsListening(false);
  }, [
    cleanupMediaStream,
    cleanupRecognitionInstance,
    clearRestartTimer,
    flushInterimToCallback,
  ]);

  const toggleListening = useCallback(() => {
    if (isTranscribing) return;
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, isTranscribing, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    isTranscribing,
    mode,
    interimText,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
