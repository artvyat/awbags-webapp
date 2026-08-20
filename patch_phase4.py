#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ФАЗА 4.1 — патчер: хуки в app.js + стили в styles.css + бамп ?v= в index.html.
Идемпотентно (маркеры), с бэкапом. По умолчанию --dry.
Запуск из папки webapp/:
    python3 patch_phase4.py           # показать, что будет сделано
    python3 patch_phase4.py --apply   # записать
"""
import argparse, re, shutil, sys, time
from pathlib import Path

STAMP = time.strftime("%Y%m%d_%H%M%S")
M_JS  = "/* ===== ZL-HOOKS (Фаза 4.1) ===== */"
M_CSS = "/* ===== ZL-STYLES (Фаза 4.1) ===== */"
M_VAR = "--counter-size"

JS_HOOKS = M_JS + r"""
/* Обёртки: не трогают исходные функции, только добавляют поведение. */
(function () {
  function wrapAfter(name, fn) {
    if (typeof window[name] === 'function') {
      var orig = window[name];
      window[name] = function () { var r = orig.apply(this, arguments); try { fn(r, arguments); } catch (e) {} return r; };
      return true;
    }
    return false;
  }

  // 1) смена зоны / материала -> пересчитать лимиты и счётчик
  try { if (typeof selectZone === 'function') { var _sz = selectZone; selectZone = function () { var r = _sz.apply(this, arguments); zlRefresh(false); return r; }; } } catch (e) {}
  try { if (typeof selectMaterial === 'function') { var _sm = selectMaterial; selectMaterial = function () { var r = _sm.apply(this, arguments); zlRefresh(false); return r; }; } } catch (e) {}
  wrapAfter('selectZone', function () { zlRefresh(false); });
  wrapAfter('selectMaterial', function () { zlRefresh(false); });

  // 2) переход на шаг 2 -> привязать валидатор
  ['goToStep', 'gotoStep', 'showStep', 'setStep'].forEach(function (n) {
    try {
      if (typeof window[n] === 'function') {
        var o = window[n];
        window[n] = function () { var r = o.apply(this, arguments); setTimeout(zlBind, 0); return r; };
      }
    } catch (e) {}
  });
  try {
    if (typeof goToStep === 'function') { var _gs = goToStep; goToStep = function () { var r = _gs.apply(this, arguments); setTimeout(zlBind, 0); return r; }; }
  } catch (e) {}

  // 2b) страховка: следим за появлением/показом шага 2
  try {
    var s2 = document.getElementById('step-2');
    if (s2 && window.MutationObserver) {
      new MutationObserver(function () { zlBind(); }).observe(s2, { attributes: true, attributeFilter: ['class', 'style'] });
    }
  } catch (e) {}

  // 3) submit -> запрет отправки при нарушении лимитов
  try {
    if (typeof submit === 'function') {
      var _sub = submit;
      submit = function () {
        var v = zlRefresh(false);
        if (!v.ok) {
          if (typeof showError === 'function') showError(v.errors[0]); else alert(v.errors[0]);
          return;
        }
        return _sub.apply(this, arguments);
      };
    }
    if (typeof window.submit === 'function' && window.submit.name !== 'submit') { /* noop */ }
  } catch (e) {}

  setTimeout(zlBind, 0);
})();
"""

CSS_VARS = """
  /* — Лимиты текста (Фаза 4) — */
  --counter-size: 12px;
  --hint-size: 12px;
  --counter-ok: #8a8a8a;
  --counter-over: #d63a3a;
"""

CSS_BLOCK = M_CSS + """
.text-meta{
  display:flex; justify-content:space-between; align-items:flex-start;
  gap:8px; margin-top:6px; flex-wrap:wrap;
}
.text-counter{
  font-size:var(--counter-size); color:var(--counter-ok);
  white-space:nowrap; font-variant-numeric:tabular-nums;
}
.text-counter.over{ color:var(--counter-over); font-weight:600; }
.text-hint{
  font-size:var(--hint-size); color:var(--counter-ok);
  flex:1 1 auto; line-height:1.3;
}
.text-hint.over{ color:var(--counter-over); }

textarea.invalid{ border-color:var(--counter-over) !important; }

@keyframes zl-shake{
  0%,100%{ transform:translateX(0); }
  25%{ transform:translateX(-3px); }
  75%{ transform:translateX(3px); }
}
.shake{ animation: zl-shake .18s ease-in-out 2; }
/* ===== /ZL-STYLES ===== */
"""


def backup(p: Path, apply: bool):
    if apply:
        shutil.copy2(p, p.with_suffix(p.suffix + f".bak_{STAMP}"))


def patch_js(apply: bool):
    p = Path("app.js")
    if not p.exists():
        print("🔴 app.js не найден (запускай из webapp/)"); return False
    src = p.read_text(encoding="utf-8")

    if "function zlRefresh" not in src:
        print("🔴 app.js: нет блока ФАЗЫ 4.1 (zlRefresh/zlBind). Сначала вставь основной код 4.1.")
        return False

    # предупреждение про старые лимиты
    for name in ("MAX_LINES", "MAX_CHARS"):
        if re.search(r"\b(const|let|var)\s+" + name + r"\b", src):
            print(f"⚠️  app.js: найдена старая константа {name} — проверь, что её проверка отключена")

    if M_JS in src:
        print("✅ app.js: хуки уже стоят, пропуск")
        return True

    out = src.rstrip() + "\n\n" + JS_HOOKS + "\n"
    print(f"➕ app.js: добавляю блок ZL-HOOKS ({len(JS_HOOKS)} симв.)")
    if apply:
        backup(p, apply); p.write_text(out, encoding="utf-8")
    return True


def patch_css(apply: bool):
    p = Path("styles.css")
    if not p.exists():
        print("🔴 styles.css не найден"); return False
    src = p.read_text(encoding="utf-8")
    out, did = src, False

    if M_VAR in out:
        print("✅ styles.css: переменные уже есть, пропуск")
    else:
        m = re.search(r":root\s*\{", out)
        if not m:
            print("⚠️  styles.css: блок :root не найден — переменные добавлю в начало файла")
            out = ":root{\n" + CSS_VARS + "}\n" + out
        else:
            i = m.end()
            out = out[:i] + "\n" + CSS_VARS.rstrip("\n") + out[i:]
        print("➕ styles.css: +4 переменные в :root")
        did = True

    if M_CSS in out:
        print("✅ styles.css: блок стилей уже есть, пропуск")
    else:
        out = out.rstrip() + "\n\n" + CSS_BLOCK + "\n"
        print("➕ styles.css: +блок ZL-STYLES в конец")
        did = True

    if did and apply:
        backup(p, apply); p.write_text(out, encoding="utf-8")
    return True


def bump_version(apply: bool):
    p = Path("index.html")
    if not p.exists():
        print("⚠️  index.html не найден — бамп ?v= пропущен"); return
    src = p.read_text(encoding="utf-8")
    new, n = re.subn(r'((?:app\.js|styles\.css))\?v=[^"\'\s]*', rf'\1?v={STAMP}', src)
    if n == 0:
        new, n = re.subn(r'((?:app\.js|styles\.css))(["\'])', rf'\1?v={STAMP}\2', src)
    print(f"🔄 index.html: обновлено ?v= у {n} ссылок → v={STAMP}")
    if n and apply:
        backup(p, apply); p.write_text(new, encoding="utf-8")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="записать изменения")
    a = ap.parse_args()

    print("=" * 56)
    print("ФАЗА 4.1 — патч хуков и стилей" + ("  [APPLY]" if a.apply else "  [DRY-RUN]"))
    print("=" * 56)

    ok = patch_js(a.apply)
    patch_css(a.apply)
    bump_version(a.apply)

    print("-" * 56)
    if not a.apply:
        print("DRY-RUN. Ничего не записано. Повтори с --apply")
    else:
        print(f"✅ Готово. Бэкапы: *.bak_{STAMP}")
    sys.exit(0 if ok else 1)
