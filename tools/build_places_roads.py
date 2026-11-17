#!/usr/bin/env python3
"""Rebuild places.json (filterable points of interest) and roads.json (the street
network the cars drive on) for Ann Arbor from OpenStreetMap via the Overpass API.

Usage:  python3 tools/build_places_roads.py

places.json: {"categories": [id, ...], "places": [[name, categoryIndex, kind, lng, lat], ...]}
roads.json:  {"nodes": [lng, lat, ...], "rank": [classIndex per node],
              "ways": [[classIndex, oneway, [nodeIndex, ...]], ...]}
"""
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

BBOX = "42.22,-83.81,42.33,-83.66"
ROOT = Path(__file__).resolve().parent.parent

# Category ids in the order the app lists them.
CATEGORIES = ["food", "coffee", "bars", "grocery", "convenience", "gas", "shopping",
              "health", "pharmacy", "gym", "parks", "hotels", "arts", "banks"]

AMENITY = {
    "restaurant": "food", "fast_food": "food", "food_court": "food", "ice_cream": "food",
    "cafe": "coffee",
    "bar": "bars", "pub": "bars", "biergarten": "bars", "nightclub": "bars",
    "fuel": "gas", "charging_station": "gas",
    "hospital": "health", "clinic": "health", "doctors": "health", "dentist": "health",
    "pharmacy": "pharmacy",
    "gym": "gym",
    "theatre": "arts", "cinema": "arts", "arts_centre": "arts", "library": "arts",
    "bank": "banks",
}
SHOP = {
    "supermarket": "grocery", "greengrocer": "grocery", "bakery": "grocery", "butcher": "grocery",
    "deli": "grocery", "farm": "grocery", "health_food": "grocery", "cheese": "grocery",
    "seafood": "grocery",
    "convenience": "convenience",
    "chemist": "pharmacy",
    "coffee": "coffee", "tea": "coffee",
}
# Shops that are services rather than places to browse; left out of "shopping".
SHOP_SKIP = {"vacant", "hairdresser", "beauty", "laundry", "dry_cleaning", "car_repair", "car",
             "tattoo", "massage", "funeral_directors", "storage_rental", "travel_agency",
             "estate_agent", "money_lender", "pawnbroker", "tyres", "car_parts", "yes", "no"}
LEISURE = {"fitness_centre": "gym", "sports_centre": "gym", "park": "parks", "nature_reserve": "parks"}
TOURISM = {"hotel": "hotels", "motel": "hotels", "guest_house": "hotels", "hostel": "hotels",
           "museum": "arts", "gallery": "arts"}

ROAD_CLASSES = ["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential"]


ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def overpass(query):
    """Run a query, retrying across public Overpass servers (they are often busy)."""
    last = None
    for attempt in range(6):
        url = ENDPOINTS[attempt % len(ENDPOINTS)]
        req = urllib.request.Request(
            url,
            data=urllib.parse.urlencode({"data": query}).encode(),
            headers={"User-Agent": "osm-ann-arbor-map-fetch/1.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=240) as resp:
                return json.load(resp)["elements"]
        except Exception as err:  # busy server, timeout, or an HTML error page
            last = err
            print(f"  {url} failed ({err}); retrying")
            time.sleep(5)
    raise SystemExit(f"Overpass unavailable: {last}")


def pretty(value):
    return value.split(";")[0].replace("_", " ").strip().capitalize()


def classify(tags):
    """Return (category, kind) or None."""
    a, s, l, t = tags.get("amenity"), tags.get("shop"), tags.get("leisure"), tags.get("tourism")
    if a in AMENITY:
        kind = tags.get("cuisine") if AMENITY[a] in ("food", "coffee") and tags.get("cuisine") else a
        return AMENITY[a], pretty(kind)
    if s:
        if s in SHOP:
            return SHOP[s], pretty(s)
        if s not in SHOP_SKIP:
            return "shopping", pretty(s)
        return None
    if l in LEISURE:
        return LEISURE[l], pretty(tags.get("sport") or l)
    if t in TOURISM:
        return TOURISM[t], pretty(t)
    return None


def build_places():
    amen = "|".join(AMENITY)
    leis = "|".join(LEISURE)
    tour = "|".join(TOURISM)
    elements = overpass(f"""[out:json][timeout:180];(
nwr["name"]["amenity"~"^({amen})$"]({BBOX});
nwr["name"]["shop"]({BBOX});
nwr["name"]["leisure"~"^({leis})$"]({BBOX});
nwr["name"]["tourism"~"^({tour})$"]({BBOX});
);out tags center;""")
    rows, seen = [], set()
    for el in elements:
        tags = el.get("tags", {})
        hit = classify(tags)
        pos = el if "lat" in el else el.get("center")
        if not hit or not pos:
            continue
        lng, lat = round(pos["lon"], 6), round(pos["lat"], 6)
        key = (tags["name"], hit[0], round(lng, 4), round(lat, 4))
        if key in seen:  # same place mapped as both a point and an outline
            continue
        seen.add(key)
        rows.append([tags["name"], CATEGORIES.index(hit[0]), hit[1], lng, lat])
    out = ROOT / "places.json"
    out.write_text(json.dumps({"categories": CATEGORIES, "places": rows},
                              separators=(",", ":"), ensure_ascii=False))
    counts = {c: sum(1 for r in rows if r[1] == i) for i, c in enumerate(CATEGORIES)}
    print(f"{len(rows)} places -> {out.name} ({out.stat().st_size / 1e3:.0f} kB)  {counts}")


def build_roads():
    classes = "|".join(ROAD_CLASSES)
    elements = overpass(f"""[out:json][timeout:180];
way["highway"~"^({classes})(_link)?$"]["tunnel"!="yes"]["access"!="private"]({BBOX});
out geom;""")
    index, coords, rank, ways = {}, [], [], []
    for el in elements:
        tags = el.get("tags", {})
        cls = ROAD_CLASSES.index(tags["highway"].replace("_link", ""))
        ow = tags.get("oneway")
        oneway = ow in ("yes", "1", "true", "-1") or (
            ow != "no" and (tags.get("junction") in ("roundabout", "circular") or cls == 0))
        ids, geom = el.get("nodes", []), el.get("geometry", [])
        if len(ids) < 2 or len(ids) != len(geom):
            continue
        path = []
        for node_id, pt in zip(ids, geom):
            if node_id not in index:
                index[node_id] = len(rank)
                coords += [round(pt["lon"], 5), round(pt["lat"], 5)]
                rank.append(cls)
            i = index[node_id]
            rank[i] = min(rank[i], cls)
            path.append(i)
        if ow == "-1":
            path.reverse()
        ways.append([cls, 1 if oneway else 0, path])
    out = ROOT / "roads.json"
    out.write_text(json.dumps({"nodes": coords, "rank": rank, "ways": ways}, separators=(",", ":")))
    print(f"{len(ways)} ways, {len(rank)} nodes -> {out.name} ({out.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    build_places()
    build_roads()
