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

def get_base_payload(sn_id):
    ref_no = f"INV-{sn_id}-{int(time.time())}"
    return {
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
        "scenarioId": sn_id,
        "items": []
    }

# 1. SN019 (Services)
print("\n--- Testing SN019 ---")
# Try saleType: " Services " (with spaces) and rates: "15%", "16%", "17%", "18.5%"
for rate in ["15%", "16%", "17%"]:
    p = get_base_payload("SN019")
    p["items"] = [{
        "hsCode": "9812.1000",
        "productDescription": "Services Test",
        "rate": rate,
        "uoM": "Numbers, pieces, units",
        "quantity": 1,
        "totalValues": 0,
        "valueSalesExcludingST": 1000,
        "fixedNotifiedValueOrRetailPrice": 0,
        "salesTaxApplicable": float(rate.replace("%", "")) * 10,
        "salesTaxWithheldAtSource": 0,
        "extraTax": "",
        "furtherTax": 0,
        "sroScheduleNo": "",
        "fedPayable": 0,
        "discount": 0,
        "saleType": " Services ",
        "sroItemSerialNo": ""
    }]
    ok, code, desc = validate_payload(p)
    if ok:
        print(f"SUCCESS SN019: Rate '{rate}' is VALID!")
        break
    else:
        print(f"  Rate '{rate}': {code} - {desc}")

# 2. SN020 (Electric Vehicle)
print("\n--- Testing SN020 ---")
# SRO options: "6th Schd Table III" with "20" or "22", or "EIGHTH SCHEDULE Table 1" with "70(i)"
sro_configs = [
    ("6th Schd Table III", "20"),
    ("6th Schd Table III", "22"),
    ("EIGHTH SCHEDULE Table 1", "70(i)"),
    ("EIGHTH SCHEDULE Table 1", "70(ii)")
]
for sro, serial in sro_configs:
    p = get_base_payload("SN020")
    p["items"] = [{
        "hsCode": "8703.8090",
        "productDescription": "EV Test",
        "rate": "1%",
        "uoM": "Numbers, pieces, units",
        "quantity": 1,
        "totalValues": 0,
        "valueSalesExcludingST": 1000000,
        "fixedNotifiedValueOrRetailPrice": 0,
        "salesTaxApplicable": 10000,
        "salesTaxWithheldAtSource": 0,
        "extraTax": "",
        "furtherTax": 0,
        "sroScheduleNo": sro,
        "fedPayable": 0,
        "discount": 0,
        "saleType": "Electric Vehicle",
        "sroItemSerialNo": serial
    }]
    ok, code, desc = validate_payload(p)
    if ok:
        print(f"SUCCESS SN020: SRO='{sro}', Serial='{serial}' is VALID!")
        break
    else:
        print(f"  SRO='{sro}', Serial='{serial}': {code} - {desc}")

# 3. SN021 (Cement)
print("\n--- Testing SN021 ---")
# Try rate "2", "3", "5", "10" or "Rs.2" etc.
# Note: Since cement rate is fixed (e.g. Rs. 2 per KG), sales tax is fixed_rate * quantity (e.g. 2 * 100 = 200).
for rate in ["2", "3", "5", "10", "Rs.2", "Rs.3", "Rs.5", "Rs.10"]:
    p = get_base_payload("SN021")
    p["items"] = [{
        "hsCode": "2523.2900",
        "productDescription": "Cement Test",
        "rate": rate,
        "uoM": "KG",
        "quantity": 100,
        "totalValues": 0,
        "valueSalesExcludingST": 1000,
        "fixedNotifiedValueOrRetailPrice": 0,
        # If rate is "2", tax is 2 * 100 = 200
        "salesTaxApplicable": 200.0 if "2" in rate else (300.0 if "3" in rate else (500.0 if "5" in rate else 1000.0)),
        "salesTaxWithheldAtSource": 0,
        "extraTax": "",
        "furtherTax": 0,
        "sroScheduleNo": "",
        "fedPayable": 0,
        "discount": 0,
        "saleType": "Cement /Concrete Block",
        "sroItemSerialNo": ""
    }]
    ok, code, desc = validate_payload(p)
    if ok:
        print(f"SUCCESS SN021: Rate '{rate}' is VALID!")
        break
    else:
        print(f"  Rate '{rate}': {code} - {desc}")

# 4. SN022 (Potassium Chlorate)
print("\n--- Testing SN022 ---")
p = get_base_payload("SN022")
p["items"] = [{
    "hsCode": "2829.1100",
    "productDescription": "Potassium Chlorate Test",
    "rate": "18%",
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
ok, code, desc = validate_payload(p)
if ok:
    print("SUCCESS SN022: Rate '18%', SRO='EIGHTH SCHEDULE Table 1', Serial='56' is VALID!")
else:
    print(f"SN022 Failed: {code} - {desc}")

# 5. SN023 (CNG)
print("\n--- Testing SN023 ---")
for rate in ["200", "Rs.200"]:
    for serial in ["Region-I", "Region-II"]:
        p = get_base_payload("SN023")
        p["items"] = [{
            "hsCode": "2711.2100",
            "productDescription": "CNG Test",
            "rate": rate,
            "uoM": "KG",
            "quantity": 10,
            "totalValues": 0,
            "valueSalesExcludingST": 1000,
            "fixedNotifiedValueOrRetailPrice": 0,
            # If rate is 200, tax is 200 * 10 = 2000
            "salesTaxApplicable": 2000,
            "salesTaxWithheldAtSource": 0,
            "extraTax": "",
            "furtherTax": 0,
            "sroScheduleNo": "581(1)/2024",
            "fedPayable": 0,
            "discount": 0,
            "saleType": "CNG Sales",
            "sroItemSerialNo": serial
        }]
        ok, code, desc = validate_payload(p)
        if ok:
            print(f"SUCCESS SN023: Rate '{rate}', Serial='{serial}' is VALID!")
            break
        else:
            print(f"  Rate='{rate}', Serial='{serial}': {code} - {desc}")
    if ok:
        break

# 6. SN024 (Goods as per SRO.297)
print("\n--- Testing SN024 ---")
p = get_base_payload("SN024")
p["items"] = [{
    "hsCode": "8421.2100",
    "productDescription": "SRO 297 Test",
    "rate": "25%",
    "uoM": "Numbers, pieces, units",
    "quantity": 1,
    "totalValues": 0,
    "valueSalesExcludingST": 1000,
    "fixedNotifiedValueOrRetailPrice": 0,
    "salesTaxApplicable": 250,
    "salesTaxWithheldAtSource": 0,
    "extraTax": "",
    "furtherTax": 0,
    "sroScheduleNo": "297(I)/2023-Table-I",
    "fedPayable": 0,
    "discount": 0,
    "saleType": "Goods as per SRO.297(|)/2023",
    "sroItemSerialNo": "3"
}]
ok, code, desc = validate_payload(p)
if ok:
    print("SUCCESS SN024: Rate '25%', SRO='297(I)/2023-Table-I', Serial='3' is VALID!")
else:
    print(f"SN024 Failed: {code} - {desc}")

# 7. SN025 (Drugs)
print("\n--- Testing SN025 ---")
p = get_base_payload("SN025")
p["items"] = [{
    "hsCode": "3004.9099",
    "productDescription": "Drugs Test",
    "rate": "0%",
    "uoM": "KG",
    "quantity": 1,
    "totalValues": 0,
    "valueSalesExcludingST": 1000,
    "fixedNotifiedValueOrRetailPrice": 0,
    "salesTaxApplicable": 0,
    "salesTaxWithheldAtSource": 0,
    "extraTax": "",
    "furtherTax": 0,
    "sroScheduleNo": "Eighth Schedule Table 1",
    "fedPayable": 0,
    "discount": 0,
    "saleType": "Non-Adjustable Supplies",
    "sroItemSerialNo": "81"
}]
ok, code, desc = validate_payload(p)
if ok:
    print("SUCCESS SN025: Rate '0%', SRO='Eighth Schedule Table 1', Serial='81' is VALID!")
else:
    print(f"SN025 Failed: {code} - {desc}")
