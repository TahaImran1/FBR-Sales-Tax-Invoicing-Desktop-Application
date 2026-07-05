import urllib.request
import json
import ssl
import os

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

token = "Bearer 5fae93d2-6831-3b1d-9a75-88c199fdb3f8"

trans_types = [
    (75, "Goods at standard rate (default)"),
    (24, "Goods at Reduced Rate"),
    (80, "Goods at zero-rate"),
    (85, "Petroleum Products"),
    (62, "Electricity Supply to Retailers"),
    (129, "SIM"),
    (77, "Gas to CNG stations"),
    (122, "Mobile Phones"),
    (25, "Processing/Conversion of Goods"),
    (23, " 3rd Schedule Goods "),
    (21, "Goods (FED in ST Mode)"),
    (22, " Services (FED in ST Mode) "),
    (18, " Services "),
    (81, "Exempt goods"),
    (82, "DTRE goods"),
    (130, "Cotton ginners"),
    (132, "Electric Vehicle"),
    (134, "Cement /Concrete Block"),
    (84, "Telecommunication services"),
    (123, "Steel melting and re-rolling"),
    (125, "Ship breaking"),
    (115, "Potassium Chlorate"),
    (178, "CNG Sales"),
    (181, "Toll Manufacturing"),
    (138, "Non-Adjustable Supplies"),
    (139, "Goods as per SRO.297(|)/2023")
]

results = {}

for tid, name in trans_types:
    url = f"https://gw.fbr.gov.pk/pdi/v2/SaleTypeToRate?date=24-Jun-2026&transTypeId={tid}&originationSupplier=1"
    req = urllib.request.Request(url)
    req.add_header("Authorization", token)
    try:
        with urllib.request.urlopen(req, context=ctx) as r:
            data = json.loads(r.read().decode('utf-8'))
            results[tid] = data
            print(f"TID {tid} ({name}): Found {len(data)} rates.")
            for rate in data:
                print(f"  Rate: {rate.get('ratE_VALUE')} / Desc: {rate.get('ratE_DESC')} / ID: {rate.get('ratE_ID')}")
    except Exception as e:
        print(f"Error fetching TID {tid}: {e}")

with open("fbr_all_rates.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)
print("Saved fbr_all_rates.json")
