import fs from "fs";
import path from "path";

const rootDir = process.cwd();
const gapsDir = path.join(rootDir, "data", "gaps");

const upTargetVault = "C:\\Users\\Тимофей\\Documents\\Level up\\Университет\\2 курс\\1 семестр\\Уголовное право (Общая часть)";
const gpTargetVault = "C:\\Users\\Тимофей\\Documents\\Level up\\Университет\\2 курс\\1 семестр\\Гражданское право (Общая часть)";

function syncGaps() {
  if (!fs.existsSync(gapsDir)) {
    console.log("No gaps directory found yet.");
    return;
  }

  const files = fs.readdirSync(gapsDir).filter(f => f.endsWith(".md"));
  console.log(`Found ${files.length} gap files:`, files);

  const upGaps = [];
  const gpGaps = [];

  for (const f of files.sort()) {
    const content = fs.readFileSync(path.join(gapsDir, f), "utf8").trim();
    if (!content || content === "Пробелов нет") continue;

    if (f.startsWith("up-")) {
      upGaps.push(`\n\n---\n# Дополнения из силлабуса: Раздел ${f.replace(".md", "")}\n\n` + content);
    } else if (f.startsWith("gp-")) {
      gpGaps.push(`\n\n---\n# Дополнения из силлабуса: Раздел ${f.replace(".md", "")}\n\n` + content);
    }
  }

  // 1. Write UP Exam Compendium to Obsidian
  if (fs.existsSync(upTargetVault) && upGaps.length > 0) {
    const upFile = path.join(upTargetVault, "!Экзамен (Силлабус и дополнения к конспектам).md");
    const header = `# Силлабус и дополнения к экзамену: Уголовное право РК (Общая часть)
> [!abstract] О материале
> Настоящий конспект содержит все вопросы официального УМК (UPRK 2208, проф. Балтабаев К.Ж., Кияшева С.К.), которые отсутствовали или требовали углубления в лекционных конспектах.
> Нормативная база: **Уголовный кодекс РК 2014 года** (с изменениями и дополнениями на 2026 год), Нормативные постановления ВС РК.
> Формат экзамена: устный билет (3 вопроса).

`;
    fs.writeFileSync(upFile, header + upGaps.join("\n\n"), "utf8");
    console.log(`Written UP Exam Compendium -> ${upFile}`);
  }

  // 2. Write GP Exam Compendium to Obsidian
  if (fs.existsSync(gpTargetVault) && gpGaps.length > 0) {
    const gpFile = path.join(gpTargetVault, "!Экзамен (Силлабус и дополнения к конспектам).md");
    const header = `# Силлабус и дополнения к экзамену: Гражданское право РК (Общая часть)
> [!abstract] О материале
> Настоящий конспект содержит вопросы официального УМК (GPRK 2207, к.ю.н., ассоц. проф. Жаркенова С.Б.), дополненные по силлабусу (организационно-правовые формы ЮЛ, защита вещных прав, денежные обязательства, перепоручение исполнения).
> Нормативная база: **Гражданский кодекс РК (Общая часть)**, Нормативные постановления ВС РК.
> Формат экзамена: устный билет (3 вопроса).

`;
    fs.writeFileSync(gpFile, header + gpGaps.join("\n\n"), "utf8");
    console.log(`Written GP Exam Compendium -> ${gpFile}`);
  }
}

syncGaps();
