Destinations JSON directory

Place your manual override JSON files here. Suggested filenames:

- popular_destinations.json
- discover_destinations.json
- authentic_destinations.json
- taste_destinations.json

Suggested record shape per file (example):

[
  {
    "name": "Paris",
    "country": "FR",
    "region_id": 1798,        // ETG region_id if known
    "aliases": ["Île‑de‑France", "Paris, France"],
    "lat": 48.8566,           // optional for geo fallback
    "lon": 2.3522,            // optional for geo fallback
    "notes": "Any notes you want"
  }
]

We can wire the backend to read these as manual overrides before calling ETG.

