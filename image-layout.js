// AWBags: настройки фотографии по модели/этапу/зоне, общие для всех цветов.
// scale = множитель вписывания; x/y = проценты ширины/высоты рамки.
(function (root) {
  'use strict';

  const STAGES = ['catalog', 'bag', 'embroidery'];
  const PROPERTIES = ['width', 'height', 'max-width', 'max-height',
    'flex-shrink', 'object-fit', 'transform', 'transform-origin'];
  const records = new WeakMap();
  let settings = { version: 1, entries: [] };

  function context(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Ожидается контекст изображения');
    }
    if (typeof value.model !== 'string' || !value.model.trim()) {
      throw new Error('Не указана модель');
    }
    if (!STAGES.includes(value.stage)) throw new Error('Неизвестный этап');
    const result = { model: value.model, stage: value.stage };
    ['size', 'material', 'zone'].forEach(field => {
      if (value[field] !== undefined && value[field] !== null && value[field] !== '') {
        if (typeof value[field] !== 'string') throw new Error('Неверное поле ' + field);
        result[field] = value[field];
      }
    });
    if (result.stage !== 'embroidery' && result.zone) {
      throw new Error('Зона задаётся только для этапа вышивки');
    }
    return result;
  }

  function key(value) {
    const c = context(value);
    return JSON.stringify([c.model, c.stage, c.size || '', c.material || '', c.zone || '']);
  }

  function placement(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Ожидаются параметры фотографии');
    }
    const result = {};
    const ranges = { scale: [0.05, 10], x: [-200, 200], y: [-200, 200], rotation: [-360, 360] };
    Object.keys(ranges).forEach(field => {
      const number = value[field] === undefined ? (field === 'scale' ? 1 : 0) : value[field];
      const range = ranges[field];
      if (typeof number !== 'number' || !Number.isFinite(number) ||
          number < range[0] || number > range[1]) {
        throw new Error('Недопустимое значение ' + field);
      }
      result[field] = number;
    });
    return result;
  }

  function validate(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.entries)) {
      throw new Error('Неверный формат настроек: нужны version: 1 и entries[]');
    }
    const seen = new Set();
    const entries = value.entries.map(entry => {
      if (!entry || typeof entry !== 'object') throw new Error('Неверная запись настроек');
      // Цветовые настройки намеренно запрещены, в том числе при импорте.
      const allowed = ['model', 'stage', 'size', 'material', 'zone', 'placement'];
      if (Object.keys(entry).some(field => !allowed.includes(field))) {
        throw new Error('Неизвестное поле записи (настройки по цветам не поддерживаются)');
      }
      const c = context(entry);
      const id = key(c);
      if (seen.has(id)) throw new Error('Повторная настройка: ' + id);
      seen.add(id);
      return Object.assign(c, { placement: placement(entry.placement) });
    });
    return { version: 1, entries };
  }

  function configure(value) {
    settings = validate(value);
    return exportSettings();
  }

  function exportSettings() {
    return JSON.parse(JSON.stringify(settings));
  }

  function resolve(value) {
    const c = context(value);
    let selected = null;
    let best = -1;
    settings.entries.forEach(entry => {
      if (entry.model !== c.model || entry.stage !== c.stage) return;
      let score = 0;
      // Зона приоритетнее материала; размер приоритетнее общего правила.
      const weights = { size: 4, material: 1, zone: 2 };
      for (const field of Object.keys(weights)) {
        if (!entry[field]) continue;
        if (entry[field] !== c[field]) return;
        score += weights[field];
      }
      if (score > best) { selected = entry; best = score; }
    });
    return selected ? Object.assign({}, selected.placement) : null;
  }

  function remember(image) {
    let record = records.get(image);
    if (record) return record;
    const original = {};
    PROPERTIES.forEach(property => {
      original[property] = [image.style.getPropertyValue(property), image.style.getPropertyPriority(property)];
    });
    record = { original, frame: null, observer: null, layout: null };
    record.onLoad = () => paint(image, record);
    image.addEventListener('load', record.onLoad);
    records.set(image, record);
    return record;
  }

  function paint(image, record) {
    const frame = record.frame;
    const p = record.layout;
    if (!frame || !p || !image.naturalWidth || !image.naturalHeight) return;
    const css = root.getComputedStyle(frame);
    const width = frame.clientWidth - (parseFloat(css.paddingLeft) || 0) - (parseFloat(css.paddingRight) || 0);
    const height = frame.clientHeight - (parseFloat(css.paddingTop) || 0) - (parseFloat(css.paddingBottom) || 0);
    if (width <= 0 || height <= 0) return;
    const angle = p.rotation * Math.PI / 180;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const rotatedWidth = image.naturalWidth * cos + image.naturalHeight * sin;
    const rotatedHeight = image.naturalWidth * sin + image.naturalHeight * cos;
    const fit = Math.min(width / rotatedWidth, height / rotatedHeight);
    image.style.setProperty('width', image.naturalWidth * fit + 'px');
    image.style.setProperty('height', image.naturalHeight * fit + 'px');
    image.style.setProperty('max-width', 'none');
    image.style.setProperty('max-height', 'none');
    image.style.setProperty('flex-shrink', '0');
    image.style.setProperty('object-fit', 'contain');
    image.style.setProperty('transform-origin', 'center center');
    image.style.setProperty('transform',
      'translate(' + width * p.x / 100 + 'px, ' + height * p.y / 100 + 'px) ' +
      'rotate(' + p.rotation + 'deg) scale(' + p.scale + ')');
  }

  function reset(image) {
    const record = records.get(image);
    if (!record) return;
    if (record.observer) record.observer.disconnect();
    image.removeEventListener('load', record.onLoad);
    PROPERTIES.forEach(property => {
      const original = record.original[property];
      if (original[0]) image.style.setProperty(property, original[0], original[1]);
      else image.style.removeProperty(property);
    });
    records.delete(image);
  }

  function applyPlacement(image, frame, value) {
    if (!image || !frame) throw new Error('Не указаны фотография и рамка');
    const p = placement(value);
    const record = remember(image);
    record.layout = p;
    if (record.frame !== frame) {
      if (record.observer) record.observer.disconnect();
      record.frame = frame;
      if (typeof root.ResizeObserver === 'function') {
        record.observer = new root.ResizeObserver(() => paint(image, record));
        record.observer.observe(frame);
      }
    }
    paint(image, record);
    return Object.assign({}, p);
  }

  function apply(image, frame, value) {
    const p = resolve(value);
    if (p) return applyPlacement(image, frame, p);
    reset(image);
    return null;
  }

  async function load(url) {
    const response = await root.fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Настройки фотографий: HTTP ' + response.status);
    return configure(await response.json());
  }

  root.AWBagsImageLayout = Object.freeze({
    key, validate, configure, exportSettings, resolve, applyPlacement, apply, reset, load
  });
})(window);