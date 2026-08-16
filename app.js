// ===== Telegram WebApp =====
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }


// ===== Состояние =====
const state = {
  step: 0,
  category: 'all',
  model: 'sstyle_mini',
  material: 'eco_suede',
  bagColor: 'blue',
  zone: 'front_pocket',
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


const MODELS = [
  { id: 'sstyle_mini', name: 'SStyle Mini', enabled: true },
];
const MATERIALS = [
  { id: 'eco_suede', name: 'Эко-замша', enabled: true },
];
const BAG_COLORS = [
  {
    id: 'blue',
    name: 'Синяя',
    image: 'images/sstyle_mini__eco_suede_blue_front_pocket.png',
    variant_id: 'eco_suede_blue_front_pocket',
  },
  {
    id: 'pink',
    name: 'Розовая',
    image: 'images/sstyle_mini__eco_suede_pink_front_pocket.png',
    variant_id: 'eco_suede_pink_front_pocket',
  },
];
const ZONES = [
  { id: 'front_pocket', name: 'Спереди над карманом', enabled: true },
  { id: 'back',         name: 'Сзади',                enabled: false },
  { id: 'side_round',   name: 'Сбоку на кругляшке',   enabled: false },
  { id: 'inside',       name: 'Внутри',               enabled: false },
];
const FONTS = [
  { id: 'cursive',  name: 'Курсив',  enabled: true },
  { id: 'straight', name: 'Прямой',  enabled: true },
  { id: 'bubble',   name: 'Бабл',    enabled: true }
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
  optModel: document.getElementById('opt-model'),
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


// ===== Загрузка каталога =====
async function loadCatalog() {
  try {
    const res = await fetch('catalog.json?v=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    // Категории: приоритет — из catalog.json, но если их нет/пусто — берём полный дефолт
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
        // поддержка нового формата (categories: []) и старого (category: "")
        const cats = Array.isArray(i.categories) ? i.categories
                   : (i.category ? [i.category] : []);
        return cats.includes(state.category);
      });

  // Пустая категория — показываем заглушку «скоро появится»
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
      // находим цвет сумки в конструкторе по variant_id из каталога
      const bagColor = BAG_COLORS.find(c => c.variant_id === item.variant_id);
      if (bagColor) state.bagColor = bagColor.id;
      if (item.bag_id) state.model = item.bag_id;
      updatePreview();
      renderBagColors();
      showStep(1);
    });
    el.catalogGrid.appendChild(card);
  });
}


function renderChips(container, items, currentId, onPick) {
  container.innerHTML = '';
  items.forEach(it => {
    const chip = document.createElement('div');
    chip.className = 'chip';
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


function renderBagColors() {
  el.optBagColor.innerHTML = '';
  BAG_COLORS.forEach(c => {
    const tile = document.createElement('div');
    tile.className = 'color-tile';
    if (c.id === state.bagColor) tile.classList.add('active');
    tile.innerHTML = `
      <img src="${c.image}" alt="${c.name}" loading="lazy">
      <div class="color-tile-name">${c.name}</div>
    `;
    tile.addEventListener('click', () => {
      state.bagColor = c.id;
      updatePreview();
      renderBagColors();
    });
    el.optBagColor.appendChild(tile);
  });
}


function renderThreadColors() {
  el.optThread.innerHTML = '';
  THREAD_COLORS.forEach(c => {
    const tile = document.createElement('div');
    tile.className = 'thread-tile';
    if (c.id === state.threadColor) tile.classList.add('active');
    tile.innerHTML = `
      ${c.img
        ? `<img class="thread-swatch" src="${c.img}" alt="${c.name}" loading="lazy">`
        : `<div class="thread-swatch" style="background:${c.hex}"></div>`}
      <div class="thread-name">${c.name}</div>
    `;
    tile.addEventListener('click', () => {
      state.threadColor = c.id;
      renderThreadColors();
    });
    el.optThread.appendChild(tile);
  });
}


function updatePreview() {
  const c = BAG_COLORS.find(x => x.id === state.bagColor);
  if (c) el.preview.src = c.image;
}


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
      { id: '1', name: 'белый',    hex: '#FFFFFF' },
      { id: '2', name: 'малиновый', hex: '#E44687' },
      { id: '3', name: 'синий',    hex: '#2767D6' },
      { id: '4', name: 'розовый',  hex: '#EA98C4' },
      { id: '5', name: 'голубой',  hex: '#B9DAE7' },
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

  if (n > 0) {
    if (el.progress) el.progress.textContent = `${n} / 2`;
    if (el.next) el.next.textContent = n === 2 ? 'Готово ✓' : 'Далее →';
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


// ===== Валидация текста =====
const MAX_LINES = 3;
const MAX_CHARS = 30;

function validateText(text) {
  if (!text || !text.trim()) {
    return { ok: false, msg: 'Текст пустой. Введи что-нибудь.' };
  }
  const lines = text.split('\n');
  if (lines.length > MAX_LINES) {
    return { ok: false, msg: `Слишком много строк (${lines.length}). Максимум ${MAX_LINES}.` };
  }
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > MAX_CHARS) {
      return { ok: false, msg: `Строка ${i + 1} длиннее ${MAX_CHARS} символов.` };
    }
  }
  return { ok: true };
}


el.text.addEventListener('input', () => {
  state.text = el.text.value;
  const v = validateText(state.text);
  if (state.text && !v.ok) {
    el.hint.textContent = v.msg;
    el.hint.classList.add('error');
  } else {
    el.hint.textContent = `До ${MAX_LINES} строк, по ${MAX_CHARS} символов`;
    el.hint.classList.remove('error');
  }
});


function submit() {
  const variant = BAG_COLORS.find(c => c.id === state.bagColor);
  if (!variant) return;
  const payload = {
    bag_id: state.model,
    variant_id: variant.variant_id,
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

  renderChips(el.optModel, MODELS, state.model,
    id => { state.model = id; renderChips(el.optModel, MODELS, state.model, _=>_); });
  renderChips(el.optMaterial, MATERIALS, state.material,
    id => { state.material = id; renderChips(el.optMaterial, MATERIALS, state.material, _=>_); });
  renderBagColors();
  updatePreview();

  renderChips(el.optZone, ZONES, state.zone,
    id => { state.zone = id; renderChips(el.optZone, ZONES, state.zone, _=>_); });
  renderChips(el.optFont, FONTS, state.font,
    id => { state.font = id; renderChips(el.optFont, FONTS, state.font, _=>_); });
  renderThreadColors();

  showStep(0);
}


init();
