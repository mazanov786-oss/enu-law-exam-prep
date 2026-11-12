"use client";

import React, { useState } from "react";
import { UserStudyState } from "@/types/exam";
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  Copy,
  Check,
  Smartphone,
  Laptop,
  Monitor,
  RefreshCw,
  X,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: UserStudyState;
  onUpdateState: (updater: (prev: UserStudyState) => UserStudyState) => void;
  onPushToCloud: () => Promise<boolean>;
  onPullFromCloud: (key?: string) => Promise<boolean>;
  isSyncing: boolean;
  lastSyncedText: string;
}

export default function SyncModal({
  isOpen,
  onClose,
  state,
  onUpdateState,
  onPushToCloud,
  onPullFromCloud,
  isSyncing,
  lastSyncedText,
}: SyncModalProps) {
  const [keyInput, setKeyInput] = useState<string>(state.syncKey || "timofey");
  const [copied, setCopied] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "ok" | "err" } | null>(
    null
  );

  if (!isOpen) return null;

  const currentHost =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://examupgp.vercel.app";
  const magicLink = `${currentHost}?sync=${encodeURIComponent(keyInput.trim().toLowerCase() || "timofey")}`;

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(magicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSaveKey = () => {
    const clean = keyInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!clean) return;
    onUpdateState((prev) => ({ ...prev, syncKey: clean }));
    setActionMessage({ text: `Ключ сохранен: «${clean}»`, type: "ok" });
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleManualPush = async () => {
    setActionMessage(null);
    const ok = await onPushToCloud();
    if (ok) {
      setActionMessage({ text: "Прогресс успешно отправлен в облако Vercel!", type: "ok" });
    } else {
      setActionMessage({ text: "Ошибка при отправке в облако. Проверьте интернет.", type: "err" });
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleManualPull = async () => {
    setActionMessage(null);
    const clean = keyInput.trim().toLowerCase();
    const ok = await onPullFromCloud(clean);
    if (ok) {
      setActionMessage({ text: "Прогресс успешно загружен из облака!", type: "ok" });
    } else {
      setActionMessage({
        text: "В облаке пока нет сохраненного прогресса для этого ключа. Сначала нажмите «Выгрузить».",
        type: "err",
      });
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">
                Синхронизация между устройствами
              </h3>
              <p className="text-xs sm:text-sm text-slate-400">
                ПК • Ноутбук • Смартфон — единый прогресс по УП и ГП РК
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sync Status Banner */}
        <div className="flex items-center justify-between rounded-2xl border border-indigo-500/30 bg-indigo-950/30 p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <div className="text-xs sm:text-sm text-slate-200">
              Статус: <strong>{lastSyncedText}</strong>
            </div>
          </div>
          {isSyncing && (
            <span className="flex items-center gap-1.5 text-xs text-indigo-300 font-semibold">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Синхронизация...
            </span>
          )}
        </div>

        {actionMessage && (
          <div
            className={`rounded-xl border p-3.5 text-sm font-semibold ${
              actionMessage.type === "ok"
                ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
                : "border-rose-500/40 bg-rose-950/30 text-rose-300"
            }`}
          >
            {actionMessage.text}
          </div>
        )}

        {/* Sync Key Setting */}
        <div className="space-y-2">
          <label className="block text-xs sm:text-sm font-bold text-slate-300">
            Твой личный ключ синхронизации:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="например, timofey"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm sm:text-base font-bold text-white focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveKey}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-200 hover:bg-slate-700 transition"
            >
              Сохранить
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Один и тот же ключ объединяет все твои устройства в единое облачное хранилище Vercel.
          </p>
        </div>

        {/* Magic Link for Mobile / Laptop */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-indigo-300">
              <Smartphone className="h-4 w-4" />
              <Laptop className="h-4 w-4" />
              <span>Быстрое подключение телефона и ноутбука</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Отправь эту ссылку себе в Telegram (в «Избранное») и открой на телефоне или ноутбуке — синхронизация включится <strong>автоматически без ввода паролей</strong>:
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={magicLink}
              className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs text-slate-300 font-mono select-all truncate"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition shadow-md shrink-0"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-300" />
                  <span>Скопировано!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Скопировать</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons: Push & Pull */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleManualPush}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs sm:text-sm font-black text-white hover:bg-emerald-500 transition shadow-lg disabled:opacity-50"
          >
            <CloudUpload className="h-4 w-4" />
            <span>Выгрузить в облако (ПК → Облако)</span>
          </button>

          <button
            type="button"
            disabled={isSyncing}
            onClick={handleManualPull}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-5 py-3 text-xs sm:text-sm font-black text-indigo-200 hover:bg-indigo-500/25 transition shadow-lg disabled:opacity-50"
          >
            <CloudDownload className="h-4 w-4" />
            <span>Загрузить из облака (Облако → Устройство)</span>
          </button>
        </div>

        {/* Devices Note */}
        <div className="flex items-center justify-center gap-6 pt-1 text-xs text-slate-500 border-t border-slate-800">
          <span className="flex items-center gap-1.5">
            <Monitor className="h-3.5 w-3.5 text-slate-400" /> Компьютер
          </span>
          <span className="flex items-center gap-1.5">
            <Laptop className="h-3.5 w-3.5 text-slate-400" /> Ноутбук
          </span>
          <span className="flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5 text-slate-400" /> Смартфон
          </span>
        </div>
      </div>
    </div>
  );
}
