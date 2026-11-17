#!/usr/bin/env python3
"""Rebuild buildings.json: names and addresses of Ann Arbor buildings from OpenStreetMap.

Usage:
    python3 tools/build_buildings.py            # download from Overpass, then build
    python3 tools/build_buildings.py raw.json   # build from an already-downloaded Overpass response

Output rows are [label, isName, [lng, lat, lng, lat, ...]] with the outline's outer ring.
"""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

BBOX = "42.22,-83.81,42.33,-83.66"
QUERY = f"""[out:json][timeout:120];(
way["building"]["name"]({BBOX});
relation["building"]["name"]({BBOX});
way["building"]["addr:housenumber"]({BBOX});
);out tags geom;"""
OUT = Path(__file__).resolve().parent.parent / "buildings.json"


def download():
    req = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=urllib.parse.urlencode({"data": QUERY}).encode(),
        headers={"User-Agent": "osm-building-names-fetch/1.0"},
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.load(resp)


def ring(geometry):
    flat = []
    for pt in geometry:
        flat += [round(pt["lon"], 6), round(pt["lat"], 6)]
    return flat


def main():
    raw = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else download()
    rows = []
    for el in raw["elements"]:
        tags = el.get("tags", {})
        name = tags.get("name")
        if name:
            label, is_name = name, 1
        elif tags.get("addr:housenumber") and tags.get("addr:street"):
            label, is_name = f'{tags["addr:housenumber"]} {tags["addr:street"]}', 0
        else:
            continue
        if el["type"] == "way":
            rings = [el.get("geometry", [])]
        else:
            rings = [m.get("geometry", []) for m in el.get("members", [])
                     if m.get("type") == "way" and m.get("role") in ("outer", "outline", "")]
        for geom in rings:
            if len(geom) >= 4:
                rows.append([label, is_name, ring(geom)])
    OUT.write_text(json.dumps(rows, separators=(",", ":"), ensure_ascii=False))
    named = sum(r[1] for r in rows)
    print(f"{len(rows)} outlines ({named} named, {len(rows) - named} address-only) -> {OUT} "
          f"({OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
