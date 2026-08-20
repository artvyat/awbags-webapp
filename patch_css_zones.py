#!/usr/bin/env python3
"""Патч styles.css: стили зон вышивки (Фаза 3, шаг 3.4). Идемпотентно."""
import re, shutil, datetime, sys, pathlib

P = pathlib.Path("styles.css")
if not P.exists():
    sys.exit("styles.css не найден — запусти из папки webapp/")

css = P.read_text(encoding="utf-8")
orig = css
done, skip = [], []

def insert_after(text, anchor, block, marker):
    if marker in text:
        skip.append(marker); return text
    i = text.find(anchor)
    if i == -1:
        skip.append(f"{marker} (якорь не найден)"); return text
    j = i + len(anchor)
    done.append(marker)
    return text[:j] + block + text[j:]

# 1) переменные зон в :root
css = insert_after(css,
    "  --chip-gap: 8px;         /* между чипами */",
    """

  /* ---------- ЗОНЫ (расположение вышивки) ---------- */
  --zone-chip-padv: 8px;         /* верт. отступ внутри чипа зоны */
  --zone-chip-padh: 14px;        /* гор. отступ */
  --zone-chip-size: 14px;        /* размер текста */
  --zone-chip-gap: 8px;          /* между чипами зон */
  --zone-soon-size: 11px;        /* размер бейджа «скоро» */
  --zone-soon-color: #A8907C;    /* цвет бейджа «скоро» */""",
    "--zone-chip-padv")

# 2) переменные второго превью
css = insert_after(css,
    "  --preview-scale: 0.45;   /* масштаб сумки внутри */",
    """
  --preview-h-step2: 260px;      /* высота окна превью на шаге 2 */
  --preview-scale-step2: 0.30;   /* масштаб сумки в нём */""",
    "--preview-h-step2")

# 3) утилита .hidden
css = insert_after(css,
    "* { box-sizing: border-box; }",
    "\n.hidden { display: none !important; }",
    ".hidden { display: none !important; }")

# 4) стили чипов зон — после блока .chip .soon {...}
if "/* ===== ЗОНЫ (расположение вышивки) ===== */" in css:
    skip.append(".zone-chip")
else:
    m = re.search(r"\.chip\s+\.soon\s*\{[^}]*\}", css)
    if m:
        block = """


/* ===== ЗОНЫ (расположение вышивки) ===== */
#opt-zone {
  gap: var(--zone-chip-gap);
}
.zone-chip {
  padding: var(--zone-chip-padv) var(--zone-chip-padh);
  font-size: var(--zone-chip-size);
}
.zone-chip .soon {
  font-size: var(--zone-soon-size);
  color: var(--zone-soon-color);
  margin-left: 5px;
  font-weight: 500;
  white-space: nowrap;
}
.zone-chip.disabled {
  background: var(--disabled);
  color: var(--text-soft);
  border-color: var(--disabled);
  cursor: not-allowed;
  opacity: 0.65;
}
.zone-chip.disabled:active {
  transform: none;
}"""
        css = css[:m.end()] + block + css[m.end():]
        done.append(".zone-chip")
    else:
        skip.append(".zone-chip (якорь .chip .soon не найден)")

# 5) превью на шаге 2 — в конец файла
if "#step-2 .preview-frame" in css:
    skip.append("#step-2 .preview-frame")
else:
    css += """


/* ===== Превью на шаге 2 (компактнее) ===== */
#step-2 .preview-frame {
  height: var(--preview-h-step2);
}
#step-2 .preview-frame img {
  transform: scale(var(--preview-scale-step2));
}
"""
    done.append("#step-2 .preview-frame")

if css == orig:
    print("Изменений нет — всё уже применено ранее.")
else:
    bak = f"styles.css.bak_{datetime.datetime.now():%Y%m%d_%H%M%S}"
    shutil.copy2(P, bak)
    P.write_text(css, encoding="utf-8")
    print(f"Бэкап: {bak}")

print("\n✅ Добавлено:", ", ".join(done) if done else "—")
print("⏭  Пропущено:", ", ".join(skip) if skip else "—")

