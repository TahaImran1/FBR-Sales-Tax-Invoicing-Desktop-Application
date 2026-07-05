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

rate_strings = [
    "18% along with rupees 60 per kilogram",
    "18% along with Rs 60 per kg",
    "18% along with Rs.60 per kg",
    "18% along with Rs. 60 per kg",
    "18% + Rs 60 / kg",
    "18% along with rupees 60/kilogram",
    "18% along with rupees 60/kg",
    "18% along with Rs. 60 per kg.",
    "18% alongwith Rs. 60 per kg",
    "18% along with rupees 60 per Kilogram",
    "18% along with Rs. 60 per Kilogram",
    "18% along with rupees 60 per kg.",
    "18%",
    "18"
]

print("--- Testing Potassium Chlorate (SN022) Rates ---")
for rate in rate_strings:
    ref_no = f"INV-SN022-{int(time.time())}"
    p = {
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
        "scenarioId": "SN022",
        "items": [{
            "hsCode": "2829.1100",
            "productDescription": "Potassium Chlorate Test",
            "rate": rate,
            "uoM": "KG",
            "quantity": 100,
            "totalValues": 0,
            "valueSalesExcludingST": 1000,
            "fixedNotifiedValueOrRetailPrice": 0,
            "salesTaxApplicable": 180,
            "salesTaxWithheldAtSource": 0,
            "extraTax": "",
            "furtherTax": 0,
            "sroScheduleNo": "EIGHTH SCHEDULE Table 1",
            "fedPayable": 0,
            "discount": 0,
            "saleType": "Potassium Chlorate",
            "sroItemSerialNo": "56"
        }]
    }
    ok, code, desc = validate_payload(p)
    if ok:
        print(f"SUCCESS: Rate '{rate}' is VALID!")
        break
    else:
        print(f"  Rate '{rate}': {code} - {desc}")
    time.sleep(0.5)  # slight delay between requests
