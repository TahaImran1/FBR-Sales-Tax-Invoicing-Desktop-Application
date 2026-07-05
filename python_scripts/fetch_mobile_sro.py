import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

token = "Bearer 5fae93d2-6831-3b1d-9a75-88c199fdb3f8"

rate_ids = [735, 736]

for rid in rate_ids:
    url = f"https://gw.fbr.gov.pk/pdi/v1/SroSchedule?rate_id={rid}&date=24-Jun-2026&origination_supplier_csv=1"
    req = urllib.request.Request(url)
    req.add_header("Authorization", token)
    try:
        with urllib.request.urlopen(req, context=ctx) as r:
            data = json.loads(r.read().decode('utf-8'))
            print(f"Rate ID {rid}: Found {len(data)} SROs.")
            for sro in data:
                sro_id = sro.get("srO_ID")
                sro_desc = sro.get("srO_DESC")
                print(f"  SRO ID {sro_id}: '{sro_desc}'")
                
                # Fetch SRO Item Serials
                sro_item_url = f"https://gw.fbr.gov.pk/pdi/v2/SROItem?date=2026-06-24&sro_id={sro_id}"
                req_item = urllib.request.Request(sro_item_url)
                req_item.add_header("Authorization", token)
                try:
                    with urllib.request.urlopen(req_item, context=ctx) as r_item:
                        items = json.loads(r_item.read().decode('utf-8'))
                        print(f"    Found {len(items)} serials for SRO {sro_id}:")
                        for it in items:
                            print(f"      Serial ID: {it.get('srO_ITEM_ID')}, Serial Desc: '{it.get('srO_ITEM_DESC')}'")
                except Exception as e_item:
                    print(f"    Error fetching serials: {e_item}")
    except Exception as e:
        print(f"Error fetching Rate ID {rid}: {e}")
