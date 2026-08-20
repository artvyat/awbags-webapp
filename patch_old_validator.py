#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ФАЗА 4 — замена старого валидатора (MAX_CHARS=30) на делегат к zl-логике.
Идемпотентно, с бэкапом. По умолчанию --dry."""
import argparse, re, shutil, time
from pathlib import Path

P = Path("app.js")
STAMP = time.strftime("%Y%m%d_%H%M%S")
MARK = "/* ZL-DELEGATE (Фаза 4) */"

NEW = MARK + """
// Старый блок (MAX_LINES=3 / MAX_CHARS=30) отключён.
// Лимиты теперь построчные и зависят от зоны + регистра — см. блок ФАЗА 4.1 внизу файла.

function validateText(text) {
  if (typeof zlValidate !== 'function') {
    return (!text || !text.trim())
      ? { ok: false, msg: 'Текст пустой. Введи что-нибудь.' }
      : { ok: true };
  }
  const v = zlValidate(text);
  return v.ok ? { ok: true } : { ok: false, msg: v.errors[0] };
}

// Ввод обрабатывает zlBind() (обрезка по лимитам + счётчик + подсказка).
// Здесь только синхронизируем state и прячем старую подсказку.
if (el.text) {
  el.text.addEventListener('input', () => { state.text = el.text.value; });
}
if (el.hint) { el.hint.textContent = ''; el.hint.style.display = 'none'; }
/* /ZL-DELEGATE */
"""

ap = argparse.ArgumentParser()
ap.add_argument("--apply", action="store_true")
a = ap.parse_args()

src = P.read_text(encoding="utf-8")

if MARK in src:
    print("✅ делегат уже стоит — пропуск"); raise SystemExit(0)

pat = re.compile(
    r"//\s*=====\s*Валидация текста.*?\n"          # заголовок блока
    r"const MAX_LINES\s*=.*?\n"
    r"const MAX_CHARS\s*=.*?\n"
    r".*?"
    r"el\.text\.addEventListener\('input',\s*\(\)\s*=>\s*\{.*?\n\}\);\n",
    re.S,
)

m = pat.search(src)
if not m:
    print("🔴 старый блок не найден — покажи sed -n '545,585p' app.js"); raise SystemExit(1)

print(f"➖ удаляю старый блок ({len(m.group(0))} симв., строки ~549–580)")
out = src[: m.start()] + NEW + src[m.end():]

# страховка: проверим, что новых определений не осталось задвоено
if out.count("function validateText") != 1:
    print(f"⚠️ validateText встречается {out.count('function validateText')} раз — проверь вручную")

if a.apply:
    shutil.copy2(P, P.with_suffix(f".js.bak_{STAMP}"))
    P.write_text(out, encoding="utf-8")
    print(f"✅ записано. бэкап: app.js.bak_{STAMP}")
else:
    print("\n--- будет вставлено ---")
    print(NEW)
    print("DRY-RUN. Повтори с --apply")
