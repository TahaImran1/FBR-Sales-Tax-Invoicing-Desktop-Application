import json

path = r"C:\Users\pc\.gemini\antigravity-ide\brain\d3f399f1-f0ef-4c5d-a4d1-f642e28c4420\scratch\fbr_saletypes.json"

with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Loaded {len(data)} items.")

def search_keywords(kws):
    print(f"\n--- Searching for: {kws} ---")
    count = 0
    for item in data:
        item_str = json.dumps(item).lower()
        if all(kw.lower() in item_str for kw in kws):
            print(json.dumps(item, indent=2))
            count += 1
            if count >= 30:
                print("... truncated ...")
                break
    if count == 0:
        print("No matches.")

# Search for potential SN019 (Services) rate mappings
search_keywords(["Services"])

# Search for SN020 (Electric Vehicle)
search_keywords(["Electric Vehicle"])

# Search for SN021 (Cement)
search_keywords(["Cement"])

# Search for SN022 (Potassium Chlorate)
search_keywords(["Potassium"])

# Search for SN023 (CNG)
search_keywords(["CNG"])

# Search for SN024 (SRO.297)
search_keywords(["SRO.297"])
search_keywords(["297"])

# Search for SN025 (Non-Adjustable Supplies / Drugs)
search_keywords(["Non-Adjustable"])
