"""
Run once: adds featured park metadata to park.geojson
Usage: python3 scripts/add-featured-parks.py
"""

import json, os

GEOJSON_PATH = os.path.join(os.path.dirname(__file__), "../frontend/public/park.geojson")

FEATURED = {
    "Lumphini Park": {
        "story": "Bangkok's most iconic running park. 2.5 km loop around the lake. Busiest at dawn and after work. Air tends to be cleanest mid-morning after traffic settles.",
        "best_time": "09:00–11:00",
        "activities": ["run", "walk", "yoga", "cycle"],
        "loop_km": 2.5,
    },
    "Benjakitti Park": {
        "story": "Scenic 1.8 km lake loop popular with evening joggers. Sits next to the expressway so PM2.5 spikes in rush hour. Best avoided 5–8 pm.",
        "best_time": "07:00–10:00",
        "activities": ["run", "walk", "cycle"],
        "loop_km": 1.8,
    },
    "Benchakitti Forest Park": {
        "story": "Elevated boardwalks through a young urban forest. Natural canopy filters some pollution. One of Bangkok's cleanest parks — great for yoga and families.",
        "best_time": "07:00–11:00",
        "activities": ["walk", "yoga", "family", "run"],
        "loop_km": 2.0,
    },
    "Chatuchak Park": {
        "story": "Large park next to the weekend market. Good 1.5 km shaded loop. Weekend crowds can affect air near the market — go early on weekdays for best conditions.",
        "best_time": "06:30–09:00",
        "activities": ["run", "walk", "dog", "cycle"],
        "loop_km": 1.5,
    },
    "Wachirabenchathat Park": {
        "story": "Known as Rot Fai Dusit. Large lake with a 3 km cycling and running track. Less crowded than Lumphini. Air quality is consistently moderate — wear a mask on hazy days.",
        "best_time": "06:00–09:00",
        "activities": ["cycle", "run", "walk", "dog"],
        "loop_km": 3.0,
    },
    "Suan Luang Rama IX": {
        "story": "Bangkok's largest public park at 200 ha. Far from the expressway so traffic pollution is lower. Long straight paths ideal for intervals. Quieter on weekday mornings.",
        "best_time": "07:00–10:00",
        "activities": ["run", "cycle", "walk", "family"],
        "loop_km": 4.0,
    },
    "Benchasiri Park": {
        "story": "Compact Sukhumvit park — only 0.6 km loop but well shaded. Popular with after-work walkers and yoga groups. Surrounded by traffic so PM2.5 can be higher.",
        "best_time": "08:00–10:00",
        "activities": ["walk", "yoga", "family"],
        "loop_km": 0.6,
    },
    "Chulalongkorn University Centennial Park": {
        "story": "Modern sloped park designed to absorb rainwater. Green rooftop design filters air. Small but excellent air quality. Popular with students and nearby office workers.",
        "best_time": "09:00–12:00",
        "activities": ["walk", "yoga", "family"],
        "loop_km": 0.8,
    },
    "Suan Luang Rama VIII Park": {
        "story": "Riverside park beside Chao Phraya. River breeze keeps PM2.5 lower than inland parks. Great sunset views. 1.2 km riverside path with good shade.",
        "best_time": "07:00–10:00",
        "activities": ["walk", "run", "family", "dog"],
        "loop_km": 1.2,
    },
    "Sri Nakhon Khuean Khan Park": {
        "story": "Bang Kachao — Bangkok's urban lung across the river. Dense mangrove and forest canopy. PM2.5 levels are consistently the lowest of any Bangkok park. Worth the ferry trip.",
        "best_time": "07:00–11:00",
        "activities": ["cycle", "walk", "run", "yoga", "family"],
        "loop_km": 8.0,
    },
}

with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

updated = 0
for feature in data["features"]:
    name_en = feature["properties"].get("name:en", "")
    if name_en in FEATURED:
        feature["properties"].pop("trend", None)  # remove old mock data
        feature["properties"].update(FEATURED[name_en])
        feature["properties"]["featured"] = True
        updated += 1
        print(f"  ✓ {name_en}")

with open(GEOJSON_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

print(f"\nDone — {updated}/{len(FEATURED)} featured parks updated in park.geojson")
if updated < len(FEATURED):
    missing = set(FEATURED.keys()) - {f["properties"].get("name:en","") for f in data["features"]}
    for m in missing:
        print(f"  ✗ Not found: {m}")
