#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import shutil, datetime
from pathlib import Path
ROOT = Path(__file__).resolve().parent
HTML, CSS = ROOT / "index.html", ROOT / "styles.css"
ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
for f in (HTML, CSS):
    b = f.with_name(f.name + ".bak_note_" + ts); shutil.copy2(f, b); print("backup:", b.name)
html = HTML.read_text(encoding="utf-8"); css = CSS.read_text(encoding="utf-8")
if ".info-note" not in css:
    css = css.replace("  --counter-over: #d63a3a;",
        "  --counter-over: #d63a3a;\n  --info-size: 13px;   /* шрифт инфо-блоков = .progress */", 1)
    css += """

/* ===== Информационные блоки (дисклеймеры) ===== */
.info-note {
  margin-top: 18px;
  font-size: var(--info-size, 13px);
  line-height: 1.5;
  color: var(--text-soft);
}
.info-note p { margin: 0 0 10px; }
.info-note p:last-child { margin-bottom: 0; }
"""
    print("css: .info-note + --info-size добавлены")
NOTE1 = """    <!-- Инфо: цвет и вышивка (шаг 1) -->
    <div class="info-note">
      <p>В зависимости от поставки цвет может отличаться на 1-2 тона. Также просим обратить внимание, что цвет основной ткани на картинке и в жизни может незначительно отличаться из-за разницы в цветопередаче на фото.</p>
      <p>Цвет подкладочной ткани подбирается в соответствии с регламентом бренда и оттенком основной ткани.</p>
      <p>На генерации вы можете сделать только фразу, имя или инициалы.<br>На макете представлена визуализация расположения и пример вышивки.<br>Размер и высота вышивки определяются согласно регламенту бренда.</p>
      <p>Если вы хотите определенный кастомный размер вышивки или нанести нестандартную вышивку в виде рисунка, пожалуйста, сообщите об этом менеджеру во время уточнения деталей заказа.</p>
    </div>
"""
NOTE2 = """    <!-- Инфо: вышивка, лейбл (шаг 2) -->
    <div class="info-note">
      <p>Если вы хотите определенный кастомный размер вышивки или нанести нестандартную вышивку в виде рисунка, пожалуйста, сообщите об этом менеджеру во время уточнения деталей заказа.<br>Бренд оставляет за собой право перенести в несколько строк фразы и цитаты, которые не помещаются по регламенту в одну строчку вышивки.</p>
      <p>Цвет лейбла на готовом изделии соответствует выбранному вами цвету вышивки или, если изделие без вышивки, лейбл делается по нашему регламенту.<br>На фото представлен пример вышивки, цвет может отличаться от готового изделия из-за особенностей визуализации.</p>
    </div>
"""
A1 = '<div class="options color-options" id="opt-bag-color"></div>'
A2 = '<div class="hint" id="text-hint">До 3 строк, по 30 символов</div>'
if "info-note" in html:
    print("html: инфо-блоки уже есть — пропуск")
else:
    assert A1 in html, "нет якоря шага 1"; assert A2 in html, "нет якоря шага 2"
    html = html.replace(A1, A1 + "\n" + NOTE1, 1).replace(A2, A2 + "\n" + NOTE2, 1)
    print("html: инфо-блоки вставлены (шаг 1 и шаг 2)")
html = html.replace("styles.css?v=20260820_164925", "styles.css?v=" + ts).replace("app.js?v=20260820_164925", "app.js?v=" + ts)
HTML.write_text(html, encoding="utf-8"); CSS.write_text(css, encoding="utf-8")
print("\nГотово.")
