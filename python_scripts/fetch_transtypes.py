import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

token = "Bearer 5fae93d2-6831-3b1d-9a75-88c199fdb3f8"

url = "https://gw.fbr.gov.pk/pdi/v1/transtypecode"
req = urllib.request.Request(url)
req.add_header("Authorization", token)

print("Fetching transaction type codes...")
try:
    with urllib.request.urlopen(req, context=ctx) as r:
        data = json.loads(r.read().decode('utf-8'))
        print(f"Success! Found {len(data)} transaction types.")
        for item in data:
            print(f"ID: {item.get('transactioN_TYPE_ID')}, Desc: {item.get('transactioN_DESC')}")
        with open("scratch/transtypecode.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
except Exception as e:
    print("Error:", e)
