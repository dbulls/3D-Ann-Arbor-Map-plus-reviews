# 3D Map of Ann Arbor: Food Reviews

An interactive 3D map of Ann Arbor, Michigan, for keeping track of restaurants and bars you've been to. Find food and bars on the map, rate them out of 5 stars, and write notes on the food, atmosphere and service.

## Features

- **3D city**: buildings extruded to their real heights, with terrain relief along the Huron River valley.
- **Day, Dusk and Night** lighting modes.
- **Building names**: hover over a building to see its name or address.
- **Food and bar filters**: pins for every restaurant, café and bar, plus a list of the places currently on screen.
- **Reviews**: click a pin to rate it from 1 to 5 stars and write notes on food, atmosphere and service. You can leave several reviews for one place, and edit or delete them later. Places you've reviewed get a gold star, and the **My reviews** filter shows only those.
- **Name your own buildings**: click any building to give it a name. You can also mark it as a restaurant or bar, which is useful when the map shows "Unnamed building" for a place you know.
- **Traffic**: cars drive along the real street network.
- **Orbit mode** slowly circles the camera.

## Running it

You need Python 3 and an internet connection (the map tiles load online). There's nothing to install.

```bash
python3 server.py
```

Then open http://localhost:8642. To use another port, run `python3 server.py 9000`.

The server only accepts connections from your own computer.

## Where your reviews are saved

Reviews and building names are saved to `data/my-data.json` on your computer, with a backup copy in your browser. The `data/` folder is in `.gitignore`, so your reviews are never committed. Back that file up yourself if you want to keep it.

If you open the site with a different server (for example `python3 -m http.server`), the map still works, but reviews are saved only in that browser.

## Controls

| Action | How |
| --- | --- |
| Pan | Drag |
| Tilt and rotate | Right-drag, or Ctrl-drag |
| Zoom | Scroll |
| Review a place | Click its pin, or its row in the list |
| Name a building | Click the building |
| Return to the start | **Overview** button |

## Project layout

| File | What it does |
| --- | --- |
| `index.html`, `style.css`, `app.js` | The map page |
| `server.py` | Small local server that serves the page and saves your data |
| `buildings.json` | Building names and addresses |
| `places.json` | Restaurants, cafés, bars and other places |
| `roads.json` | Street network the cars drive on |
| `tools/` | Scripts that rebuild the three data files from OpenStreetMap |

## Updating the map data

The data files are prebuilt from OpenStreetMap. To refresh them with the latest data:

```bash
python3 tools/build_buildings.py
python3 tools/build_places_roads.py
```

These download from the public Overpass API and can take a minute or two.

## Credits

- Map rendering: [MapLibre GL JS](https://maplibre.org/)
- Map tiles: [OpenFreeMap](https://openfreemap.org/)
- Map data: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the Open Database License
- Elevation: [Mapzen terrain tiles](https://registry.opendata.aws/terrain-tiles/) on AWS Open Data
