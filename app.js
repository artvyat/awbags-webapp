// ===== Telegram WebApp =====
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }


// ===== Состояние =====
const state = {
  step: 0,
  category: 'all',
  item: null,          // текущий выбранный товар из каталога (объект целиком)
  material: null,      // id выбранного материала внутри item.materials
  bagColor: null,      // id выбранного цвета внутри material.colors
  zone: null,          // id выбранной зоны (из material.zones)
  font: 'cursive',
  threadColor: '3',
  text: '',
};


// ===== Конфиг =====
let CATALOG = [];       // грузится из catalog.json
let CATEGORIES = [];    // грузится из catalog.json (или из DEFAULT_CATEGORIES)

// Полный список категорий — показываются ВСЕГДА, даже если товаров нет
const DEFAULT_CATEGORIES = [
  { id: 'all',         name: 'Все' },
  { id: 'everyday',    name: 'Повседневные' },
  { id: 'sport',       name: 'Спортивные' },
  { id: 'travel',      name: 'Дорожные' },
  { id: 'mini',        name: 'Сумки мини' },
  { id: 'beauty',      name: 'Косметички' },
  { id: 'cases',       name: 'Кейсы' },
  { id: 'accessories', name: 'Аксессуары' },
];

// Фолбэк-зоны — используются, только если у материала НЕТ zones[] в catalog.json
const DEFAULT_ZONES = [
  { id: 'front_pocket', name: 'Спереди над карманом', order: 1, enabled: true,  available: true,  default: true },
  { id: 'back',         name: 'Сзади',                order: 2, enabled: true,  available: false },
  { id: 'side_round',   name: 'Сбоку на кругляшке',   order: 3, enabled: true,  available: false },
  { id: 'inside',       name: 'Внутри',               order: 4, enabled: false, available: false },
];

const FONTS = [
  { id: 'cursive',  name: 'Курсив',  enabled: true },
  { id: 'straight', name: 'Прямой',  enabled: true },
  { id: 'bubble',   name: 'Бабл',    enabled: true },
];

let THREAD_COLORS = [];


// ===== DOM =====
const el = {
  step0: document.getElementById('step-0'),
  step1: document.getElementById('step-1'),
  step2: document.getElementById('step-2'),
  categoryTabs: document.getElementById('category-tabs'),
  catalogGrid: document.getElementById('catalog-grid'),
  preview: document.getElementById('preview-img'),
  preview2: document.getElementById('preview-img-2'),
  optMaterial: document.getElementById('opt-material'),
  optBagColor: document.getElementById('opt-bag-color'),
  optZone: document.getElementById('opt-zone'),
  optFont: document.getElementById('opt-font'),
  optThread: document.getElementById('opt-thread-color'),
  text: document.getElementById('opt-text'),
  hint: document.getElementById('text-hint'),
  back: document.getElementById('btn-back'),
  next: document.getElementById('btn-next'),
  progress: document.getElementById('progress'),
  navbar: document.getElementById('navbar') || document.querySelector('.navbar'),
};

// Проверка: если какой-то элемент не найден — пишем в консоль, но не ломаемся
Object.entries(el).forEach(([key, node]) => {
  if (!node) console.warn(`app.js: элемент "${key}" не найден в index.html — проверь id`);
});


// ===== Хелперы для текущего товара =====

// Возвращает materials[] текущего товара.
// Поддержка старого формата: если materials нет, оборачиваем colors[] в 1 материал.
function currentMaterials() {
  if (!state.item) return [];

  if (Array.isArray(state.item.materials) && state.item.materials.length) {
    return state.item.materials;
  }

  // fallback — старый формат (colors[] на уровне товара)
  const legacyColors = Array.isArray(state.item.colors) && state.item.colors.length
    ? state.item.colors
    : (state.item.variant_id ? [{
        id: 'default',
        name: state.item.title || 'Вариант',
        variant_id: state.item.variant_id,
        image: state.item.image,
      }] : []);

  return [{
    id: 'default',
    name: state.item.material_name || '—',
    bag_id: state.item.bag_id,
    colors: legacyColors,
  }];
}

function currentMaterial() {
  const mats = currentMaterials();
  return mats.find(m => m.id === state.material) || mats[0] || null;
}

function currentColors() {
  const mat = currentMaterial();
  return (mat && Array.isArray(mat.colors)) ? mat.colors : [];
}

function currentColor() {
  const colors = currentColors();
  return colors.find(c => c.id === state.bagColor) || colors[0] || null;
}


// ===== Хелперы зон =====

// Зоны текущего материала. Если в каталоге их нет — фолбэк на DEFAULT_ZONES.
function currentZones() {
  const mat = currentMaterial();
  const zones = (mat && Array.isArray(mat.zones) && mat.zones.length)
    ? mat.zones
    : DEFAULT_ZONES;

  // enabled:false — зону вообще не показываем (например inside)
  return zones
    .filter(z => z.enabled !== false)
    .slice()
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

// Зона доступна, если:
//  1) не помечена available:false (фото ракурса ещё не сняты)
//  2) у выбранного цвета есть превью этой зоны (если previews вообще задан)
function isZoneAvailable(zone, color) {
  if (!zone) return false;
  if (zone.enabled === false) return false;
  if (zone.available === false) return false;

  const c = color || currentColor();
  if (c && c.previews && !c.previews[zone.id]) return false;

  return true;
}

// Дефолтная зона: помеченная default:true среди доступных,
// иначе первая доступная, иначе первая вообще.
function defaultZoneId() {
  const zones = currentZones();
  const color = currentColor();
  const avail = zones.filter(z => isZoneAvailable(z, color));
  const def = avail.find(z => z.default === true);
  return (def || avail[0] || zones[0])?.id || null;
}

function currentZone() {
  const zones = currentZones();
  return zones.find(z => z.id === state.zone) || null;
}

// Тихий откат на дефолтную зону, если текущая недоступна (вариант A).
// Возвращает true, если зона изменилась.
function ensureValidZone() {
  const z = currentZone();
  if (z && isZoneAvailable(z)) return false;
  const fallback = defaultZoneId();
  if (state.zone === fallback) return false;
  state.zone = fallback;
  return true;
}

// Путь к превью для зоны: previews[zone] → preview_image → image
function previewSrcForZone(zoneId) {
  const c = currentColor();
  if (!c) return '';
  return (c.previews && c.previews[zoneId]) || c.preview_image || c.image || '';
}

// Лимиты текущей зоны (пригодятся в Фазе 4)
function currentZoneLimits() {
  const z = currentZone();
  return z && z.limits ? z.limits : null;
}


// ===== Загрузка каталога =====
async function loadCatalog() {
  try {
    const res = await fetch('catalog.json?v=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    CATEGORIES = (Array.isArray(data.categories) && data.categories.length)
      ? data.categories
      : DEFAULT_CATEGORIES;
    CATALOG = data.items || [];
  } catch (err) {
    console.error('Не удалось загрузить catalog.json', err);
    CATEGORIES = DEFAULT_CATEGORIES;
    CATALOG = [];
  }
}


// ===== Рендер категорий =====
function renderCategories() {
  el.categoryTabs.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const tab = document.createElement('div');
    tab.className = 'category-tab';
    if (cat.id === state.category) tab.classList.add('active');
    tab.textContent = cat.name;
    tab.addEventListener('click', () => {
      state.category = cat.id;
      renderCategories();
      renderCatalog();
    });
    el.categoryTabs.appendChild(tab);
  });
}


// ===== Рендер каталога =====
function renderCatalog() {
  el.catalogGrid.innerHTML = '';

  const items = state.category === 'all'
    ? CATALOG
    : CATALOG.filter(i => {
        const cats = Array.isArray(i.categories) ? i.categories
                   : (i.category ? [i.category] : []);
        return cats.includes(state.category);
      });

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'catalog-empty';
    empty.innerHTML = `
      <div class="catalog-empty-icon">🎒</div>
      <p class="catalog-empty-text">Изделия этой категории скоро появятся</p>
    `;
    el.catalogGrid.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'catalog-card';
    card.innerHTML = `
      <div class="catalog-photo">
        ${item.badge ? `<span class="catalog-badge">${item.badge}</span>` : ''}
        <img src="${item.image}" alt="${item.title}" loading="lazy">
      </div>
      <h3 class="catalog-name">${item.title}</h3>
      ${item.subtitle ? `<p class="catalog-subtitle">${item.subtitle}</p>` : ''}
      <p class="catalog-price">${item.price}</p>
      <button class="catalog-btn">Собрать сумку</button>
    `;
    card.querySelector('.catalog-btn').addEventListener('click', () => {
      openConstructor(item);
    });
    el.catalogGrid.appendChild(card);
  });
}


// ===== Открытие конструктора для конкретного товара =====
function openConstructor(item) {
  state.item = item;

  const mats = currentMaterials();
  state.material = mats.length ? mats[0].id : null;

  const colors = currentColors();
  state.bagColor = colors.length ? colors[0].id : null;

  state.zone = defaultZoneId();

  renderMaterials();
  renderBagColors();
  renderZones();
  updatePreview();
  preloadZonePreviews();
  showStep(1);
}


// ===== Материал — кликабельные чипы =====
function renderMaterials() {
  const mats = currentMaterials();
  el.optMaterial.innerHTML = '';

  // если материал один — чип статичный (некликабельный)
  const single = mats.length < 2;

  mats.forEach(m => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.dataset.id = m.id;
    if (m.id === state.material) chip.classList.add('active');
    chip.textContent = m.name;
    if (!single) {
      chip.addEventListener('click', () => selectMaterial(m.id));
    }
    el.optMaterial.appendChild(chip);
  });
}

function selectMaterial(id) {
  if (state.material === id) return;
  state.material = id;

  // пробуем сохранить тот же цвет (gray/black/khaki есть у обоих материалов),
  // иначе берём первый доступный
  const colors = currentColors();
  const keep = colors.find(c => c.id === state.bagColor);
  state.bagColor = keep ? keep.id : (colors[0]?.id || null);

  // переключаем active у чипов без полной пересборки
  el.optMaterial.querySelectorAll('.chip').forEach(ch =>
    ch.classList.toggle('active', ch.dataset.id === id)
  );

  ensureValidZone();   // тихий откат зоны, если у нового материала её нет

  renderBagColors();   // тут пересборка нужна — набор цветов другой
  renderZones();       // набор зон у другого материала может отличаться
  updatePreview();
  preloadZonePreviews();
}


// ===== Универсальные чипы (шрифт) =====
function renderChips(container, items, currentId, onPick) {
  container.innerHTML = '';
  items.forEach(it => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.dataset.id = it.id;
    if (!it.enabled) chip.classList.add('disabled');
    if (it.id === currentId && it.enabled) chip.classList.add('active');
    chip.innerHTML = it.enabled
      ? it.name
      : `${it.name}<span class="soon">скоро</span>`;
    if (it.enabled) {
      chip.addEventListener('click', () => onPick(it.id));
    }
    container.appendChild(chip);
  });
}


// ===== Зоны (расположение вышивки) =====
function renderZones() {
  if (!el.optZone) return;

  const zones = currentZones();
  const color = currentColor();
  el.optZone.innerHTML = '';

  // если зон нет вообще — прячем блок и его заголовок
  const wrapHidden = zones.length === 0;
  el.optZone.classList.toggle('hidden', wrapHidden);
  const title = el.optZone.previousElementSibling;
  if (title && title.classList.contains('group-title')) {
    title.classList.toggle('hidden', wrapHidden);
  }
  if (wrapHidden) return;

  zones.forEach(z => {
    const ok = isZoneAvailable(z, color);
    const chip = document.createElement('div');
    chip.className = 'chip zone-chip';
    chip.dataset.id = z.id;
    if (!ok) chip.classList.add('disabled');
    if (ok && z.id === state.zone) chip.classList.add('active');
    chip.innerHTML = ok
      ? z.name
      : `${z.name}<span class="soon">скоро</span>`;
    if (ok) {
      chip.addEventListener('click', () => selectZone(z.id));
    }
    el.optZone.appendChild(chip);
  });
}

function selectZone(id) {
  if (state.zone === id) return;   // уже выбрана — ничего не делаем
  state.zone = id;

  // только переключаем active, БЕЗ пересборки сетки
  el.optZone.querySelectorAll('.zone-chip').forEach(ch =>
    ch.classList.toggle('active', ch.dataset.id === id)
  );

  updatePreview();
}


// ===== Цвета корпуса — из текущего материала =====
function renderBagColors() {
  el.optBagColor.innerHTML = '';
  const colors = currentColors();
  colors.forEach(c => {
    const tile = document.createElement('div');
    tile.className = 'color-tile';
    tile.dataset.id = c.id;
    if (c.id === state.bagColor) tile.classList.add('active');
    tile.innerHTML = `
      <img src="${c.image}" alt="${c.name}" loading="lazy">
      <div class="color-tile-name">${c.name}</div>
    `;
    tile.addEventListener('click', () => {
      if (state.bagColor === c.id) return;  // уже выбран — ничего не делаем
      state.bagColor = c.id;

      // только переключаем active, БЕЗ пересборки сетки:
      el.optBagColor.querySelectorAll('.color-tile').forEach(t =>
        t.classList.toggle('active', t.dataset.id === c.id)
      );

      // у нового цвета может не быть текущей зоны → тихий откат
      if (ensureValidZone()) renderZones();
      else refreshZoneAvailability();

      updatePreview();
      preloadZonePreviews();
    });
    el.optBagColor.appendChild(tile);
  });
}

// Обновляет доступность чипов зон без полной пересборки
function refreshZoneAvailability() {
  if (!el.optZone) return;
  const zones = currentZones();
  const color = currentColor();
  el.optZone.querySelectorAll('.zone-chip').forEach(ch => {
    const z = zones.find(x => x.id === ch.dataset.id);
    const ok = isZoneAvailable(z, color);
    ch.classList.toggle('disabled', !ok);
    ch.classList.toggle('active', ok && ch.dataset.id === state.zone);
  });
}


// ===== Цвета ниток =====
function renderThreadColors() {
  el.optThread.innerHTML = '';
  THREAD_COLORS.forEach(c => {
    const tile = document.createElement('div');
    tile.className = 'thread-tile';
    tile.dataset.id = c.id;
    if (c.id === state.threadColor) tile.classList.add('active');
    tile.innerHTML = `
      ${c.img
        ? `<img class="thread-swatch" src="${c.img}" alt="${c.name}" loading="lazy">`
        : `<div class="thread-swatch" style="background:${c.hex}"></div>`}
      <div class="thread-name">${c.name}</div>
    `;
    tile.addEventListener('click', () => {
      if (state.threadColor === c.id) return;
      state.threadColor = c.id;
      el.optThread.querySelectorAll('.thread-tile').forEach(t =>
        t.classList.toggle('active', t.dataset.id === c.id)
      );
    });
    el.optThread.appendChild(tile);
  });
}


// ===== Превью (оба окна: шаг 1 и шаг 2) =====
function updatePreview() {
  const src = previewSrcForZone(state.zone);
  if (!src) return;
  if (el.preview  && el.preview.getAttribute('src')  !== src) el.preview.src  = src;
  if (el.preview2 && el.preview2.getAttribute('src') !== src) el.preview2.src = src;
}

// Фоновая предзагрузка превью соседних зон — переключение без задержки
function preloadZonePreviews() {
  const color = currentColor();
  currentZones().forEach(z => {
    if (z.id === state.zone) return;
    if (!isZoneAvailable(z, color)) return;
    const src = previewSrcForZone(z.id);
    if (src) { const img = new Image(); img.src = src; }
  });
}


// ===== Цвета ниток: загрузка =====
async function loadThreadColors() {
  try {
    const res = await fetch('colors.json?v=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    THREAD_COLORS = Object.entries(data).map(([id, c]) => ({
      id,
      name: c.name,
      hex: c.hex,
      img: c.img,
    }));
  } catch (err) {
    console.error('Не удалось загрузить colors.json, fallback', err);
    THREAD_COLORS = [
      { id: '1', name: 'белый',     hex: '#FFFFFF' },
      { id: '2', name: 'малиновый', hex: '#E44687' },
      { id: '3', name: 'синий',     hex: '#2767D6' },
      { id: '4', name: 'розовый',   hex: '#EA98C4' },
      { id: '5', name: 'голубой',   hex: '#B9DAE7' },
    ];
  }
}


// ===== Шаги =====
function showStep(n) {
  state.step = n;
  el.step0.classList.toggle('hidden', n !== 0);
  el.step1.classList.toggle('hidden', n !== 1);
  el.step2.classList.toggle('hidden', n !== 2);

  if (el.navbar) {
    el.navbar.classList.toggle('hidden', n === 0);
  }

  if (n === 2) updatePreview();   // синхронизируем второе окно

  if (n > 0) {
    if (el.progress) el.progress.textContent = `${n} / 2`;
    if (el.next) el.next.textContent = n === 2 ? 'Готово ✓' : 'Далее →';
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


/* ZL-DELEGATE (Фаза 4) */
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


// ===== Сборка variant_id =====
// ВАЖНО: суффикс зоны берём из zone_suffix (у замши "front_pocket", у джинсы "front")
function computeVariantId() {
  const mat = currentMaterial();
  const color = currentColor();
  if (!mat || !color) return null;

  const suffix = mat.zone_suffix && state.zone ? mat.zone_suffix[state.zone] : null;
  if (mat.variant_prefix && suffix) {
    return `${mat.variant_prefix}_${color.id}_${suffix}`;
  }
  // фолбэк — старый формат (variant_id прописан у цвета)
  return color.variant_id || null;
}


function submit() {
  const mat = currentMaterial();
  const color = currentColor();
  if (!state.item || !mat || !color) return;

  const variantId = computeVariantId();
  if (!variantId) {
    console.error('Не удалось вычислить variant_id', { mat, color, zone: state.zone });
    return;
  }

  const payload = {
    bag_id: mat.bag_id || state.item.bag_id || state.item.id,
    variant_id: variantId,
    text: state.text,
    color_id: state.threadColor,
    font_id: state.font,
  };
  console.log('Submit:', payload);
  if (tg && tg.sendData) {
    tg.sendData(JSON.stringify(payload));
  } else {
    alert('payload: ' + JSON.stringify(payload, null, 2));
  }
}


// ===== Навигация =====
el.next.addEventListener('click', () => {
  if (state.step === 1) {
    showStep(2);
    return;
  }
  if (state.step === 2) {
    const v = validateText(state.text);
    if (!v.ok) {
      el.hint.textContent = v.msg;
      el.hint.classList.add('error');
      el.text.focus();
      return;
    }
    submit();
  }
});

el.back.addEventListener('click', () => {
  if (state.step === 2) showStep(1);
  else if (state.step === 1) showStep(0);
});


// ===== Инициализация =====
async function init() {
  await loadThreadColors();
  await loadCatalog();

  renderCategories();
  renderCatalog();

  // step-2 общие опции
  renderChips(el.optFont, FONTS, state.font, id => {
    state.font = id;
    el.optFont.querySelectorAll('.chip').forEach(ch =>
      ch.classList.toggle('active', ch.dataset.id === id)
    );
  });
  renderThreadColors();

  showStep(0);
}

init();

/* ═══════════════════════════════════════════════════════════════
   ФАЗА 4.1 — ЛИМИТЫ СИМВОЛОВ ПО ЗОНАМ (построчно, по регистру)
   Правило: строка ВСЯ КАПСОМ → caps-лимит, иначе → normal-лимит.
   Цифры/знаки игнорируются при детекте регистра, но СЧИТАЮТСЯ в длине.
   ═══════════════════════════════════════════════════════════════ */

const ZL_DEFAULT_LIMITS = {
  normal: { max_chars_per_line: 11, max_lines: 3 },
  caps:   { max_chars_per_line: 7,  max_lines: 3 }
};

const ZL_EMOJI_G = /[\p{Extended_Pictographic}\u200D\uFE0F]/gu;
const ZL_EMOJI_T = /[\p{Extended_Pictographic}\u200D\uFE0F]/u;

function zlPlural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function zlTextarea() {
  return (typeof el === 'object' && el && (el.text || el.textInput || el.textarea))
      || document.querySelector('#step-2 textarea')
      || document.querySelector('textarea');
}

function zlZone() {
  try {
    const zones = (typeof currentZones === 'function') ? currentZones() : [];
    return zones.find(z => z.id === state.zone) || zones[0] || null;
  } catch (e) { return null; }
}

function zlLimits() {
  const z = zlZone();
  const L = (z && z.limits) ? z.limits : ZL_DEFAULT_LIMITS;
  return {
    normal: L.normal || ZL_DEFAULT_LIMITS.normal,
    caps:   L.caps   || L.normal || ZL_DEFAULT_LIMITS.caps
  };
}

function zlMaxLines() {
  const L = zlLimits();
  return Math.max(L.normal.max_lines || 1, L.caps.max_lines || 1);
}

/** режим строки: 'caps' если ВСЕ буквы заглавные (и буквы вообще есть) */
function zlLineMode(line) {
  const letters = [...line].filter(ch => ch.toLowerCase() !== ch.toUpperCase());
  if (!letters.length) return 'normal';
  return letters.every(ch => ch === ch.toUpperCase()) ? 'caps' : 'normal';
}

function zlLineLimit(line) {
  return zlLimits()[zlLineMode(line)].max_chars_per_line;
}

/** приведение текста к лимитам (для ввода/вставки) */
function zlSanitize(raw) {
  let changed = null;
  let t = String(raw).replace(/\r\n?/g, '\n');

  const noEmoji = t.replace(ZL_EMOJI_G, '');
  if (noEmoji !== t) { t = noEmoji; changed = 'emoji'; }

  let lines = t.split('\n');
  const ML = zlMaxLines();
  if (lines.length > ML) { lines = lines.slice(0, ML); changed = changed || 'lines'; }

  lines = lines.map(l => {
    const lim = zlLineLimit(l);
    if (l.length > lim) { changed = changed || 'chars'; return l.slice(0, lim); }
    return l;
  });

  return { text: lines.join('\n'), changed };
}

/** проверка БЕЗ изменения текста (для смены зоны и для submit) */
function zlValidate(raw) {
  const t = String(raw || '').replace(/\r\n?/g, '\n');
  const lines = t.split('\n');
  const ML = zlMaxLines();
  const errors = [];

  if (ZL_EMOJI_T.test(t)) errors.push('Эмодзи не поддерживаются');
  if (lines.length > ML) errors.push(`Максимум ${ML} ${zlPlural(ML,'строка','строки','строк')}`);

  lines.forEach((l, i) => {
    const lim = zlLineLimit(l);
    if (l.length > lim) errors.push(`Строка ${i + 1} — ${l.length} симв., максимум ${lim}`);
  });

  if (t.trim() === '') errors.push('Введите текст');
  else if (lines.some(l => l.trim() === '')) errors.push('Пустые строки не допускаются');

  return { ok: errors.length === 0, errors, lines };
}

/* ---------- UI: счётчик + подсказка ---------- */

function zlMeta() {
  const ta = zlTextarea();
  if (!ta) return null;
  let box = document.getElementById('zl-meta');
  if (!box) {
    box = document.createElement('div');
    box.id = 'zl-meta';
    box.className = 'text-meta';
    box.innerHTML = '<span class="text-counter" id="zl-counter"></span>' +
                    '<span class="text-hint" id="zl-hint"></span>';
    ta.insertAdjacentElement('afterend', box);
  }
  return box;
}

function zlNextBtn() {
  return document.getElementById('btn-submit')
      || document.getElementById('btn-generate')
      || document.querySelector('#step-2 .btn-primary, #step-2 .nav-next, #step-2 .btn-next');
}

function zlRefresh(flash) {
  const ta = zlTextarea();
  if (!ta) return { ok: false, errors: ['Поле ввода не найдено'], lines: [] };
  zlMeta();

  const counter = document.getElementById('zl-counter');
  const hint    = document.getElementById('zl-hint');
  const v = zlValidate(ta.value);
  const L = zlLimits(), ML = zlMaxLines();

  // строка под кареткой
  const pos = (ta.selectionStart != null) ? ta.selectionStart : ta.value.length;
  const idx = Math.max(0, Math.min(ta.value.slice(0, pos).split('\n').length - 1, v.lines.length - 1));
  const cur = v.lines[idx] || '';
  const curLim = zlLineLimit(cur);

  if (counter) {
    counter.textContent = `${cur.length}/${curLim} · ${v.lines.length}/${ML}`;
    counter.classList.toggle('over', !v.ok);
  }
  if (hint) {
    hint.textContent = v.ok
      ? `Максимум ${L.normal.max_chars_per_line} симв. в строке (${L.caps.max_chars_per_line} — если ЗАГЛАВНЫМИ) · до ${ML} ${zlPlural(ML,'строки','строк','строк')}`
      : v.errors[0];
    hint.classList.toggle('over', !v.ok);
  }

  ta.classList.toggle('invalid', !v.ok && ta.value.trim() !== '');

  if (flash) { ta.classList.remove('shake'); void ta.offsetWidth; ta.classList.add('shake'); }

  const btn = zlNextBtn();
  if (btn) { btn.disabled = !v.ok; btn.classList.toggle('disabled', !v.ok); }

  return v;
}

function zlBind() {
  const ta = zlTextarea();
  if (!ta || ta.dataset.zlBound) { zlRefresh(false); return; }
  ta.dataset.zlBound = '1';
  ta.removeAttribute('maxlength');           // старый жёсткий лимит больше не нужен

  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey === false) { /* noop */ }
    if (e.key === 'Enter') {
      if (ta.value.split('\n').length >= zlMaxLines()) {
        e.preventDefault();
        zlRefresh(true);
      }
    }
  });

  ta.addEventListener('input', () => {
    const before = ta.value;
    const pos = ta.selectionStart;
    const s = zlSanitize(before);
    if (s.text !== before) {
      const delta = before.length - s.text.length;
      ta.value = s.text;
      const np = Math.max(0, Math.min(s.text.length, pos - delta));
      try { ta.setSelectionRange(np, np); } catch (e) {}
      zlRefresh(true);
    } else {
      zlRefresh(false);
    }
    if (typeof state === 'object' && state) state.text = ta.value;
  });

  ['click', 'keyup', 'select', 'focus'].forEach(ev =>
    ta.addEventListener(ev, () => zlRefresh(false))
  );

  zlRefresh(false);
}

document.addEventListener('DOMContentLoaded', () => setTimeout(zlBind, 0));

/* ===== ZL-HOOKS (Фаза 4.1) ===== */
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

