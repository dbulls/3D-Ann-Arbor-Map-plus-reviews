#!/usr/bin/env python3
"""Add restaurants, cafés and bars from Overture Maps to places.json.

OpenStreetMap is missing many Ann Arbor businesses. Overture Maps (open data,
CDLA-Permissive-2.0) has much better coverage, so this adds its food and drink
places that aren't already in places.json. Existing rows are left untouched, so
reviews you've written stay attached to their places.

Usage:
    pip install overturemaps
    overturemaps download --bbox=-83.81,42.22,-83.66,42.33 -f geojsonseq -t place -o overture.geojsonseq
    python3 tools/add_overture_places.py overture.geojsonseq

Run tools/build_places_roads.py first if you are rebuilding everything, since it
overwrites places.json.
"""
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIN_CONFIDENCE = 0.6
MATCH_METRES = 120  # same name within this distance = the same place

# Overture taxonomy level 2 -> our category
GROUPS = {
    "restaurant": "food",
    "casual_eatery": "food",
    "non_alcoholic_beverage_venue": "coffee",
    "alcoholic_beverage_venue": "bars",
}
STOP = {"the", "restaurant", "cafe", "café", "bar", "grill", "and", "of", "co", "company",
        "ann", "arbor", "inc", "llc", "kitchen", "pub", "tavern", "eatery"}
COMPANY = re.compile(r"\b(inc|llc|pllc|corp|mgmt|ltd)\b\.?|\bdba\b", re.I)


def tokens(name):
    words = re.findall(r"[a-z0-9]+", name.lower().replace("'", "").replace("’", ""))
    return {w for w in words if w not in STOP} or set(words)


def same_name(a, b):
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return False
    return len(ta & tb) / min(len(ta), len(tb)) >= 0.6


def metres(lng1, lat1, lng2, lat2):
    dx = (lng2 - lng1) * 111320 * math.cos(math.radians(lat1))
    dy = (lat2 - lat1) * 110540
    return math.hypot(dx, dy)


def kind_of(primary, category):
    if not primary:
        return {"food": "Restaurant", "coffee": "Café", "bars": "Bar"}[category]
    words = primary.replace("_restaurant", "").replace("_", " ").strip()
    return words.capitalize()


def main(path):
    out = ROOT / "places.json"
    data = json.loads(out.read_text())
    cats = data["categories"]
    rows = data["places"]
    existing = [r for r in rows if cats[r[1]] in GROUPS.values()]

    added, skipped_dupe, seen = [], 0, []
    for line in open(path, encoding="utf-8"):
        f = json.loads(line)
        p = f["properties"]
        hier = (p.get("taxonomy") or {}).get("hierarchy") or []
        if len(hier) < 2 or hier[0] != "food_and_drink" or hier[1] not in GROUPS:
            continue
        if p.get("operating_status") == "permanently_closed":
            continue
        if (p.get("confidence") or 0) < MIN_CONFIDENCE:
            continue
        name = ((p.get("names") or {}).get("primary") or "").strip()
        if not name or COMPANY.search(name):
            continue
        sources = {s.get("dataset") for s in p.get("sources") or []} - {"Overture", "Overture-signals"}
        if sources <= {"BrightQuery"}:
            continue  # business registrations, often not a place you can visit
        if sources <= {"Foursquare", "BrightQuery"} and (
                p.get("operating_status") != "open" or p.get("confidence", 0) < 0.9):
            continue  # Foursquare-only listings are often stale unless well confirmed
        lng, lat = (round(c, 6) for c in f["geometry"]["coordinates"][:2])
        category = GROUPS[hier[1]]
        if any(same_name(name, r[0]) and metres(lng, lat, r[3], r[4]) < MATCH_METRES
               for r in existing + seen):
            skipped_dupe += 1
            continue
        row = [name, cats.index(category), kind_of((p.get("taxonomy") or {}).get("primary"), category), lng, lat]
        seen.append(row)
        added.append(row)

    data["places"] = rows + added
    data.setdefault("sources", ["OpenStreetMap"])
    if "Overture Maps" not in data["sources"]:
        data["sources"].append("Overture Maps")
    out.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
    by_cat = {}
    for r in added:
        by_cat[cats[r[1]]] = by_cat.get(cats[r[1]], 0) + 1
    print(f"Added {len(added)} places {by_cat}; skipped {skipped_dupe} already listed")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
