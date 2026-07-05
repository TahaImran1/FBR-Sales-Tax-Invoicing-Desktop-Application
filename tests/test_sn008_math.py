import urllib.request
import json
import ssl
import time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

token = "Bearer 5fae93d2-6831-3b1d-9a75-88c199fdb3f8"
url_validate = "https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb"

ref_no = f"INV-SN008-{int(time.time() * 1000)}"
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
  "scenarioId": "SN008",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "test",
      "rate": "18%",
      "uoM": "Numbers, pieces, units",
      "quantity": 100,
      "totalValues": 145,
      "valueSalesExcludingST": 145,
      "fixedNotifiedValueOrRetailPrice": 100000,
      "salesTaxApplicable": 18000,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "3rd Schedule Goods",
      "sroItemSerialNo": ""
    }
  ]
}

req = urllib.request.Request(url_validate, data=json.dumps(payload).encode('utf-8'))
req.add_header("Content-Type", "application/json")
req.add_header("Authorization", token)

try:
    with urllib.request.urlopen(req, context=ctx) as res:
        raw_body = res.read().decode('utf-8')
        print("Raw response body:")
        print(raw_body)
        try:
            resp = json.loads(raw_body)
            print("Parsed response:")
            print(json.dumps(resp, indent=2))
        except Exception as json_err:
            print("Failed to parse JSON:", json_err)
except Exception as e:
    print("Failed:", e)

