import urllib.request
import json
import ssl
import time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

token = "Bearer 5fae93d2-6831-3b1d-9a75-88c199fdb3f8"
url_validate = "https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb"

def validate_payload(payload):
    req = urllib.request.Request(url_validate, data=json.dumps(payload).encode('utf-8'))
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", token)
    try:
        with urllib.request.urlopen(req, context=ctx) as res:
            resp = json.loads(res.read().decode('utf-8'))
            val_res = resp.get("validationResponse", {})
            status = val_res.get("status", "")
            if status.lower() == "valid":
                return True, "VALID", ""
            else:
                statuses = val_res.get("invoiceStatuses", [])
                err_desc = statuses[0].get("error", "") if statuses else val_res.get("error", "")
                err_code = statuses[0].get("errorCode", "") if statuses else val_res.get("errorCode", "")
                return False, err_code, err_desc
    except Exception as e:
        return False, "HTTP_ERROR", str(e)

hscodes = ["8517.1300", "8517.1490", "8517.1100", "8517.1219", "8517.1890"]

# We will test Rate 18% with NINTH SCHEDULE serials 1(A), 1(B), 1(E), 1(F)
# And Rate 25% with NINTH SCHEDULE serials 1(B), 1(G)
tests = [
    ("18%", "NINTH SCHEDULE", "1(A)"),
    ("18%", "NINTH SCHEDULE", "1(B)"),
    ("18%", "NINTH SCHEDULE", "1(E)"),
    ("18%", "NINTH SCHEDULE", "1(F)"),
    ("25%", "NINTH SCHEDULE", "1(B)"),
    ("25%", "NINTH SCHEDULE", "1(G)")
]

print("--- Testing SN015 (Mobile Phones) configurations ---")
success_found = False
for hs in hscodes:
    for rate, sro, serial in tests:
        ref_no = f"INV-SN015-{int(time.time() * 1000)}"
        rate_val = float(rate.replace("%", ""))
        payload = {
            "invoiceType": "Sale Invoice",
            "invoiceDate": "2026-06-24",
            "sellerNTNCNIC": "3653258",
            "sellerBusinessName": "Vertex Medical (Pvt) Limited",
            "sellerProvince": "Punjab",
            "sellerAddress": "61-CCA, 2nd FLOOR, EX-PARK VIEW, DHA PHASE VIII, LAHORE, PAKISTAN.",
            "buyerNTNCNIC": "9020846",
            "buyerBusinessName": "MOMENTUM LOGISTICS (PVT) LIMITED (Alt)",
            "buyerProvince": "PUNJAB",
            "buyerAddress": "LAHORE",
            "buyerRegistrationType": "Registered",
            "invoiceRefNo": ref_no,
            "scenarioId": "SN015",
            "items": [{
                "hsCode": hs,
                "productDescription": "Mobile Phone Test",
                "rate": rate,
                "uoM": "Numbers, pieces, units",
                "quantity": 1,
                "totalValues": 0,
                "valueSalesExcludingST": 1000,
                "fixedNotifiedValueOrRetailPrice": 1000, # or 0
                "salesTaxApplicable": 1000 * (rate_val / 100),
                "salesTaxWithheldAtSource": 0,
                "extraTax": "",
                "furtherTax": 0,
                "sroScheduleNo": sro,
                "fedPayable": 0,
                "discount": 0,
                "saleType": "Mobile Phones",
                "sroItemSerialNo": serial
            }]
        }
        ok, code, desc = validate_payload(payload)
        if ok:
            print(f"SUCCESS: HS {hs}, Rate {rate}, SRO {sro}, Serial {serial} is VALID!")
            success_found = True
            break
        else:
            print(f"  HS {hs}, Rate {rate}, Serial {serial}: {code} - {desc}")
        time.sleep(0.3)
    if success_found:
        break
