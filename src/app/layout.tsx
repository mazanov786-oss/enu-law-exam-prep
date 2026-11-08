import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ЕНУ Юрфак • Подготовка к экзаменам (УП РК и ГП РК)",
  description:
    "Интерактивная платформа подготовки к устной сессии по Уголовному праву РК (Общая часть) и Гражданскому праву РК (Общая часть): рандомайзер билетов (3 вопроса), голосовой ввод, тесты, прочерк, интервальные карточки и разбор ошибок.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
