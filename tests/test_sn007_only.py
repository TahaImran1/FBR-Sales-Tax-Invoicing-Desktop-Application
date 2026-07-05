import urllib.request
import json
import ssl
import time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

token = "Bearer 5fae93d2-6831-3b1d-9a75-88c199fdb3f8"
url_validate = "https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb"

ref_no = f"INV-SN007-{int(time.time() * 1000)}"
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
    "scenarioId": "SN007",
    "items": [{
        "hsCode": "8421.2100",
        "productDescription": "Zero Rated Test",
        "rate": "0%",
        "uoM": "Numbers, pieces, units",
        "quantity": 1,
        "totalValues": 0,
        "valueSalesExcludingST": 1000,
        "fixedNotifiedValueOrRetailPrice": 0,
        "salesTaxApplicable": 0,
        "salesTaxWithheldAtSource": 0,
        "extraTax": "",
        "furtherTax": 0,
        "sroScheduleNo": "FIFTH SCHEDULE",
        "fedPayable": 0,
        "discount": 0,
        "saleType": "Goods at zero-rate",
        "sroItemSerialNo": "1(i)"
    }]
}

req = urllib.request.Request(url_validate, data=json.dumps(payload).encode('utf-8'))
req.add_header("Content-Type", "application/json")
req.add_header("Authorization", token)

try:
    with urllib.request.urlopen(req, context=ctx) as res:
        resp = json.loads(res.read().decode('utf-8'))
        print(json.dumps(resp, indent=2))
except Exception as e:
    print("Failed:", e)
