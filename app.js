const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const state = {
  catalog: [],
  colors: [],
  selectedBag: null,
  selectedColorId: null,
  text: "",
};

const $screenCatalog = document.getElementById("screen-catalog");
const $screenBuilder = document.getElementById("screen-builder");
const $catalogGrid   = document.getElementById("catalog-grid");
const $btnBack       = document.getElementById("btn-back");
const $builderTitle  = document.getElementById("builder-title");
const $builderSub    = document.getElementById("builder-subtitle");
const $previewImg    = document.getElementById("preview-img");
const $textInput     = document.getElementById("text-input");
const $textError     = document.getElementById("text-error");
const $textHint      = document.getElementById("text-hint");
const $colorGrid     = document.getElementById("color-grid");
const $colorName     = document.getElementById("selected-color-name");
const $btnSubmit     = document.getElementById("btn-submit");

const MAX_CHARS = 12;
const ALLOWED_RE = /^[A-Za-zА-Яа-яЁё0-9 .,!?'"\-_:;()]*$/;

async function loadData() {
  const [catalogRes, colorsRes] = await Promise.all([
    fetch("catalog.json?v=5"),
    fetch("colors.json?v=5"),
  ]);
  const catalog = await catalogRes.json();
  const colors  = await colorsRes.json();
  state.catalog = catalog.bags || [];
  state.colors  = Array.isArray(colors) ? colors : (colors.colors || []);
}

function formatPrice(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function renderCatalog() {
  $catalogGrid.innerHTML = "";
  state.catalog.forEach(bag => {
    const card = document.createElement("div");
    card.className = "catalog-card";
    card.innerHTML = `
      <div class="catalog-card-img-wrap">
        <img src="${bag.image}" alt="${bag.title}">
      </div>
      <div class="catalog-card-body">
        <p class="catalog-card-title">${bag.title}</p>
        <p class="catalog-card-subtitle">${bag.subtitle}</p>
        <p class="catalog-card-price">от ${formatPrice(bag.price_from)} ₽</p>
      </div>
    `;
    card.addEventListener("click", () => openBuilder(bag));
    $catalogGrid.appendChild(card);
  });
}

function openBuilder(bag) {
  state.selectedBag = bag;
  state.text = "";
  state.selectedColorId = null;

  $builderTitle.textContent = bag.title;
  $builderSub.textContent   = bag.subtitle;
  $previewImg.src = bag.image;
  $previewImg.alt = bag.title;

  $textInput.value = "";
  $textError.textContent = "";
  $textInput.classList.remove("error");
  $textHint.textContent = `до ${MAX_CHARS} символов`;

  renderColors();
  updateSubmitState();
  showScreen("builder");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderColors() {
  $colorGrid.innerHTML = "";
  state.colors.forEach(color => {
    const sw = document.createElement("div");
    sw.className = "color-swatch";
    sw.style.backgroundColor = color.hex;
    sw.dataset.id = color.id;
    sw.title = color.name;
    sw.addEventListener("click", () => selectColor(color.id));
    $colorGrid.appendChild(sw);
  });
  $colorName.textContent = "Выбери цвет ниток";
}

function selectColor(id) {
  state.selectedColorId = id;
  document.querySelectorAll(".color-swatch").forEach(sw => {
    sw.classList.toggle("selected", sw.dataset.id == id);
  });
  const c = state.colors.find(x => x.id == id);
  $colorName.textContent = c ? c.name : "—";
  updateSubmitState();
}

function validateText(value) {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, msg: "" };
  if (trimmed.length > MAX_CHARS) {
    return { ok: false, msg: `Слишком длинно (макс. ${MAX_CHARS} симв.)` };
  }
  if (!ALLOWED_RE.test(trimmed)) {
    return { ok: false, msg: "Недопустимые символы" };
  }
  return { ok: true, msg: "" };
}

$textInput.addEventListener("input", e => {
  const v = e.target.value;
  const res = validateText(v);
  state.text = v.trim();
  if (v && !res.ok) {
    $textError.textContent = res.msg;
    $textInput.classList.add("error");
  } else {
    $textError.textContent = "";
    $textInput.classList.remove("error");
  }
  updateSubmitState();
});

function updateSubmitState() {
  const hasText  = state.text.length > 0 && validateText(state.text).ok;
  const hasColor = state.selectedColorId !== null;
  $btnSubmit.disabled = !(hasText && hasColor && state.selectedBag);
}

$btnBack.addEventListener("click", () => showScreen("catalog"));

$btnSubmit.addEventListener("click", () => {
  if ($btnSubmit.disabled) return;
  const payload = {
    bag_id:        state.selectedBag.id,
    bag_model:     state.selectedBag.model,
    bag_variant:   state.selectedBag.variant,
    bag_title:     state.selectedBag.title,
    bag_subtitle:  state.selectedBag.subtitle,
    text:          state.text,
    color_id:      state.selectedColorId,
  };
  try {
    tg.sendData(JSON.stringify(payload));
    tg.close();
  } catch (e) {
    console.error("sendData failed:", e);
    alert("Не удалось отправить данные. Попробуйте ещё раз.");
  }
});

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  if (name === "catalog") {
    $screenCatalog.classList.add("active");
    tg.BackButton.hide();
  } else if (name === "builder") {
    $screenBuilder.classList.add("active");
    tg.BackButton.show();
  }
}

tg.BackButton.onClick(() => {
  if ($screenBuilder.classList.contains("active")) showScreen("catalog");
  else tg.close();
});

(async function init() {
  try {
    await loadData();
    renderCatalog();
    showScreen("catalog");
  } catch (e) {
    console.error("Init failed:", e);
    document.body.innerHTML = `
      <div style="padding: 40px 20px; text-align: center;">
        <h2>Ошибка загрузки</h2>
        <p style="color: #888;">${e.message}</p>
      </div>
    `;
  }
})();
