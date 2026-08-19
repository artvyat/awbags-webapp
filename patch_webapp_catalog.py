#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_webapp_catalog.py — обновляет блок colors товара sstyle_mini (Эко-замша)
в webapp/catalog.json на все 18 цветов замши.

Пути картинок: images/suede/<cid>.jpg (плитка) + images/suede_big/<cid>.jpg (превью)
— их уже создал build_suede.py.

Запуск (из папки webapp/):
  python3 patch_webapp_catalog.py --dry   # показать, не менять
  python3 patch_webapp_catalog.py         # применить (с бэкапом)
"""
import argparse
import json
import os
import shutil
import sys
from datetime import datetime

CATALOG = "catalog.json"          # запускается из webapp/
BAG_ID  = "sstyle_mini"

# порядок = как в папках Конструктора; (cid, RU-имя для витрины)
COLORS = [
    ("gray",         "Серая"),
    ("graphite",     "Графит"),
    ("lavender",     "Лавандовая"),
    ("light_blue",   "Голубая"),
    ("blue",         "Синяя"),
    ("powder",       "Пудровая"),
    ("pink",         "Розовая"),
    ("raspberry",    "Малиновая"),
    ("beige",        "Бежевая"),
    ("sand",         "Песочная"),
    ("black",        "Черная"),
    ("brown",        "Коричневая"),
    ("cappuccino",   "Капучино"),
    ("khaki",        "Хаки"),
    ("lemon",        "Лимонная"),
    ("mint",         "Мятная"),
    ("snow_leopard", "Снежный барс"),
    ("pistachio",    "Фисташковая"),
]


def build_colors():
    out = []
    for cid, name in COLORS:
        out.append({
            "id": cid,
            "name": name,
            "variant_id": f"eco_suede_{cid}_front_pocket",
            "image": f"images/suede/{cid}.jpg",
            "preview_image": f"images/suede_big/{cid}.jpg",
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    if not os.path.isfile(CATALOG):
        sys.exit(f"❌ Нет файла {CATALOG}. Запускай из папки webapp/")

    with open(CATALOG, encoding="utf-8") as f:
        cat = json.load(f)

    items = cat.get("items")
    if not isinstance(items, list):
        sys.exit("❌ В catalog.json нет массива 'items'.")

    target = None
    for it in items:
        if isinstance(it, dict) and it.get("bag_id") == BAG_ID:
            target = it
            break
    if target is None:
        sys.exit(f"❌ Товар bag_id={BAG_ID} не найден в items.")

    colors = build_colors()
    print(f"Товар: {target.get('title')}")
    print(f"Было цветов:  {len(target.get('colors', []))}")
    print(f"Станет:       {len(colors)}")
    for c in colors:
        print(f"   {c['id']:<13} {c['name']:<15} -> {c['image']}")

    if args.dry:
        print("\n(dry-run) Ничего не изменено.")
        return

    # бэкап
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    bak = f"{CATALOG}.bak_{stamp}"
    shutil.copy2(CATALOG, bak)

    # обновляем
    target["colors"] = colors
    target["image"] = colors[0]["image"]            # обложка = первый цвет
    target["material_name"] = "Эко-замша"
    target["title"] = "SStyle Mini Эко-замша"

    with open(CATALOG, "w", encoding="utf-8") as f:
        json.dump(cat, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Обновлено. Бэкап: {bak}")
    print("   colors:", len(colors))
    print("\nДальше: git add catalog.json && git commit -m 'замша 18 цветов' && git push")


if __name__ == "__main__":
    main()
