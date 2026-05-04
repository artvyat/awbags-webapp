const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const grid = document.getElementById('catalog');

async function loadCatalog() {
  try {
    const res = await fetch('catalog.json?v=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    renderCatalog(data.items || []);
  } catch (err) {
    grid.innerHTML = '<div class="empty">Ошибка: ' + err.message + '</div>';
    console.error(err);
  }
}

function renderCatalog(items) {
  if (!items.length) {
    grid.innerHTML = '<div class="empty">Пока нет товаров</div>';
    return;
  }
  grid.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-frame">
        <span class="badge">10+ цветов</span>
        <img src="${item.image}" alt="${item.title}" loading="lazy">
      </div>
      <div class="card-title">${item.title}</div>
      <div class="card-price">${item.price}</div>
      <button class="card-button" type="button">Собрать сумку</button>
    `;
    const fire = (e) => { e.stopPropagation(); selectItem(item); };
    card.querySelector('.card-button').addEventListener('click', fire);
    card.addEventListener('click', fire);
    grid.appendChild(card);
  });
}

function selectItem(item) {
  const payload = {
    action: 'select_bag',
    bag_id: item.bag_id,
    variant_id: item.variant_id,
    title: item.title,
  };
  if (tg && tg.sendData) {
    tg.sendData(JSON.stringify(payload));
  } else {
    alert('Выбрано: ' + item.title);
    console.log('payload:', payload);
  }
}

loadCatalog();
