// ===== Telegram WebApp =====
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// ===== Состояние =====
const state = {
  step: 1,
  // Шаг 1
  model: 'sstyle_mini',
  material: 'eco_suede',
  bagColor: 'blue',
  // Шаг 2
  zone: 'front_pocket',
  font: 'cursive',
  threadColor: '3', // ID из colors.json (по умолчанию синий)
  text: '',
};

// ===== Конфиг =====
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
];

// Цвета ниток подгружаются с GitHub (один источник истины — colors.json в корне репо).
// Но Pages не отдаст файл вне webapp/ — поэтому держим локальную копию здесь.
let THREAD_COLORS = [];

// ===== DOM =====
const el = {
  step1: document.getElementById('step-1'),
  step2: document.getElementById('step-2'),
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
};

// ===== Утилы рендера =====
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
      <div class="thread-swatch" style="background:${c.hex}"></div>
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

// ===== Загрузка цветов ниток =====
async function loadThreadColors() {
  try {
    const res = await fetch('colors.json?v=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    // data — это объект {id: {name, hex, rgb}}, превращаем в массив
    THREAD_COLORS = Object.entries(data).map(([id, c]) => ({
      id,
      name: c.name,
      hex: c.hex,
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
  el.step1.classList.toggle('hidden', n !== 1);
  el.step2.classList.toggle('hidden', n !== 2);
  el.progress.textContent = `${n} / 2`;
  el.back.style.visibility = n === 1 ? 'hidden' : 'visible';
  el.next.textContent = n === 2 ? 'Готово ✓' : 'Далее →';
  // Скролл вверх
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

// ===== Submit =====
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
  // Шаг 2 → Готово
  const v = validateText(state.text);
  if (!v.ok) {
    el.hint.textContent = v.msg;
    el.hint.classList.add('error');
    el.text.focus();
    return;
  }
  submit();
});

el.back.addEventListener('click', () => {
  if (state.step === 2) showStep(1);
});

// ===== Инициализация =====
async function init() {
  await loadThreadColors();

  renderChips(el.optModel,    MODELS,    state.model,    id => { state.model = id; renderChips(el.optModel, MODELS, state.model, _=>_); });
  renderChips(el.optMaterial, MATERIALS, state.material, id => { state.material = id; renderChips(el.optMaterial, MATERIALS, state.material, _=>_); });
  renderBagColors();
  updatePreview();

  renderChips(el.optZone, ZONES, state.zone, id => { state.zone = id; renderChips(el.optZone, ZONES, state.zone, _=>_); });
  renderChips(el.optFont, FONTS, state.font, id => { state.font = id; renderChips(el.optFont, FONTS, state.font, _=>_); });
  renderThreadColors();

  showStep(1);
}

init();