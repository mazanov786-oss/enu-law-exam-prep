"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface SpeechRecognitionHook {
  isListening: boolean;
  isSupported: boolean;
  interimText: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

export function useSpeechRecognition(
  onFinalTranscript: (text: string) => void
): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const shouldKeepListeningRef = useRef(false);
  const callbackRef = useRef(onFinalTranscript);

  useEffect(() => {
    callbackRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalChunk = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalChunk += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      if (finalChunk.trim()) {
        // Light cleanup for spoken Russian legal abbreviations
        const formatted = finalChunk
          .replace(/\bстатья\s+(\d+)/gi, "ст. $1")
          .replace(/\bук\s+рк\b/gi, "УК РК")
          .replace(/\bгк\s+рк\b/gi, "ГК РК")
          .replace(/\bкоап\s+рк\b/gi, "КоАП РК")
          .replace(/\bупк\s+рк\b/gi, "УПК РК")
          .replace(/\bвс\s+рк\b/gi, "ВС РК");
        callbackRef.current(formatted.trim());
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }
      if (event.error === "not-allowed") {
        setError("Доступ к микрофону запрещен в браузере. Разрешите доступ в адресной строке.");
        shouldKeepListeningRef.current = false;
        setIsListening(false);
      } else {
        setError(`Ошибка распознавания речи: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setInterimText("");
      if (shouldKeepListeningRef.current) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
          shouldKeepListeningRef.current = false;
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldKeepListeningRef.current = false;
      try {
        recognition.stop();
      } catch {}
    };
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    if (!recognitionRef.current) {
      setError("Ваш браузер не поддерживает Web Speech API (используйте Chrome или Edge).");
      return;
    }
    try {
      shouldKeepListeningRef.current = true;
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // Already started
      setIsListening(true);
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    setInterimText("");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    interimText,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
