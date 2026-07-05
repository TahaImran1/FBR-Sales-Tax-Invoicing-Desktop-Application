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
    ref_no = f"INV-{sn_id}-{int(time.time() * 1000)}"
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

scenarios = {}

# Define configs for all 28 scenarios
for i in range(1, 29):
    sn = f"SN{i:03d}"
    
    # Defaults
    payload = get_base_payload(sn)
    item = {
        "hsCode": "8421.2100",
        "productDescription": "Standard Product Test",
        "rate": "18%",
        "uoM": "Numbers, pieces, units",
        "quantity": 1,
        "totalValues": 0,
        "valueSalesExcludingST": 1000,
        "fixedNotifiedValueOrRetailPrice": 0,
        "salesTaxApplicable": 180,
        "salesTaxWithheldAtSource": 0,
        "extraTax": "",
        "furtherTax": 0,
        "sroScheduleNo": "",
        "fedPayable": 0,
        "discount": 0,
        "saleType": "Goods at standard rate (default)",
        "sroItemSerialNo": ""
    }
    
    if sn == "SN001":
        pass
    elif sn == "SN002":
        payload["buyerNTNCNIC"] = "1000000000000"
        payload["buyerRegistrationType"] = "Unregistered"
        payload["buyerProvince"] = "SINDH"
        payload["buyerBusinessName"] = "FERTILIZER MANUFAC IRS NEW"
        item["furtherTax"] = 40.0
    elif sn == "SN003":
        item["hsCode"] = "7214.1010"
        item["uoM"] = "MT"
        item["saleType"] = "Steel melting and re-rolling"
        item["valueSalesExcludingST"] = 207000
        item["salesTaxApplicable"] = 37260
    elif sn == "SN004":
        item["hsCode"] = "7204.4910"
        item["uoM"] = "MT"
        item["saleType"] = "Ship breaking"
        item["valueSalesExcludingST"] = 175000
        item["salesTaxApplicable"] = 31500
    elif sn == "SN005":
        payload["buyerNTNCNIC"] = "1000000000000"
        payload["buyerRegistrationType"] = "Unregistered"
        payload["buyerProvince"] = "SINDH"
        payload["buyerBusinessName"] = "FERTILIZER MANUFAC IRS NEW"
        item["hsCode"] = "0102.2930"
        item["saleType"] = "Goods at Reduced Rate"
        item["rate"] = "1%"
        item["sroScheduleNo"] = "EIGHTH SCHEDULE Table 1"
        item["sroItemSerialNo"] = "82"
        item["salesTaxApplicable"] = 10
    elif sn == "SN006":
        item["saleType"] = "Exempt goods"
        item["rate"] = "Exempt"
        item["sroScheduleNo"] = "6th Schd Table I"
        item["sroItemSerialNo"] = "100"
        item["salesTaxApplicable"] = 0
    elif sn == "SN007":
        item["saleType"] = "Goods at zero-rate"
        item["rate"] = "0%"
        item["sroScheduleNo"] = "FIFTH SCHEDULE"
        item["sroItemSerialNo"] = "1(i)"
        item["salesTaxApplicable"] = 0
    elif sn == "SN008":
        item["saleType"] = " 3rd Schedule Goods "
        item["fixedNotifiedValueOrRetailPrice"] = 2000
        item["sroScheduleNo"] = "THIRD SCHEDULE"
        item["salesTaxApplicable"] = 360
    elif sn == "SN009":
        item["hsCode"] = "5201.0090"
        item["uoM"] = "KG"
        item["saleType"] = "Cotton Ginners"
        item["salesTaxWithheldAtSource"] = 180
    elif sn == "SN010":
        item["hsCode"] = "9812.1000"
        item["saleType"] = "Telecommunication services"
        item["rate"] = "19.5%"
        item["salesTaxApplicable"] = 195
    elif sn == "SN011":
        # Known not to be implemented by gateway
        item["hsCode"] = "7214.1010"
        item["uoM"] = "MT"
        item["saleType"] = "Toll Manufacturing"
        item["valueSalesExcludingST"] = 207000
        item["salesTaxApplicable"] = 37260
    elif sn == "SN012":
        item["hsCode"] = "2710.1210"
        item["uoM"] = "Liter"
        item["saleType"] = "Petroleum Products"
    elif sn == "SN013":
        item["hsCode"] = "2716.0000"
        item["uoM"] = "KWH"
        item["saleType"] = "Electricity Supply to Retailers"
        item["rate"] = "7.5%"
        item["salesTaxApplicable"] = 75
    elif sn == "SN014":
        item["hsCode"] = "2711.2100"
        item["uoM"] = "MMBTU"
        item["saleType"] = "Gas to CNG stations"
    elif sn == "SN015":
        item["hsCode"] = "8517.1490"
        item["saleType"] = "Mobile Phones"
        item["sroScheduleNo"] = "NINTH SCHEDULE"
        item["sroItemSerialNo"] = "1(A)"
        item["fixedNotifiedValueOrRetailPrice"] = 1000
    elif sn == "SN016":
        item["saleType"] = "Processing/Conversion of Goods"
    elif sn == "SN017":
        item["saleType"] = "Goods (FED in ST Mode)"
        item["rate"] = "17%"
        item["salesTaxApplicable"] = 170
    elif sn == "SN018":
        item["hsCode"] = "9812.1000"
        item["saleType"] = " Services (FED in ST Mode) "
        item["rate"] = "19.5%"
        item["salesTaxApplicable"] = 195
    elif sn == "SN019":
        item["hsCode"] = "9812.1000"
        item["saleType"] = " Services "
        item["rate"] = "16%"
        item["salesTaxApplicable"] = 160
    elif sn == "SN020":
        item["hsCode"] = "8703.8090"
        item["saleType"] = "Electric Vehicle"
        item["rate"] = "1%"
        item["sroScheduleNo"] = "6th Schd Table III"
        item["sroItemSerialNo"] = "20"
        item["valueSalesExcludingST"] = 1000000
        item["salesTaxApplicable"] = 10000
    elif sn == "SN021":
        item["hsCode"] = "2523.2900"
        item["uoM"] = "KG"
        item["saleType"] = "Cement /Concrete Block"
        item["rate"] = "Rs.2"
        item["quantity"] = 100
        item["salesTaxApplicable"] = 200
    elif sn == "SN022":
        item["hsCode"] = "2829.1100"
        item["uoM"] = "KG"
        item["saleType"] = "Potassium Chlorate"
        item["rate"] = "18% along with rupees 60 per kilogram"
        item["sroScheduleNo"] = "EIGHTH SCHEDULE Table 1"
        item["sroItemSerialNo"] = "56"
        item["quantity"] = 100
        item["salesTaxApplicable"] = 6180
    elif sn == "SN023":
        item["hsCode"] = "2711.2100"
        item["uoM"] = "KG"
        item["saleType"] = "CNG Sales"
        item["rate"] = "Rs.200"
        item["sroScheduleNo"] = "581(1)/2024"
        item["sroItemSerialNo"] = "Region-I"
        item["quantity"] = 10
        item["salesTaxApplicable"] = 2000
    elif sn == "SN024":
        item["saleType"] = "Goods as per SRO.297(|)/2023"
        item["rate"] = "25%"
        item["sroScheduleNo"] = "297(I)/2023-Table-I"
        item["sroItemSerialNo"] = "3"
        item["salesTaxApplicable"] = 250
    elif sn == "SN025":
        item["hsCode"] = "3004.9099"
        item["uoM"] = "KG"
        item["saleType"] = "Non-Adjustable Supplies"
        item["rate"] = "0%"
        item["sroScheduleNo"] = "Eighth Schedule Table 1"
        item["sroItemSerialNo"] = "81"
        item["salesTaxApplicable"] = 0
    elif sn == "SN026":
        payload["buyerNTNCNIC"] = "9999997"
        payload["buyerRegistrationType"] = "Unregistered"
        payload["buyerProvince"] = "PUNJAB"
        payload["buyerBusinessName"] = "Infrastructure Lahore"
    elif sn == "SN027":
        payload["buyerNTNCNIC"] = "9999997"
        payload["buyerRegistrationType"] = "Unregistered"
        payload["buyerProvince"] = "PUNJAB"
        payload["buyerBusinessName"] = "Infrastructure Lahore"
        item["saleType"] = " 3rd Schedule Goods "
        item["fixedNotifiedValueOrRetailPrice"] = 2000
        item["sroScheduleNo"] = "THIRD SCHEDULE"
        item["salesTaxApplicable"] = 360
    elif sn == "SN028":
        payload["buyerNTNCNIC"] = "9999997"
        payload["buyerRegistrationType"] = "Unregistered"
        payload["buyerProvince"] = "PUNJAB"
        payload["buyerBusinessName"] = "Infrastructure Lahore"
        item["hsCode"] = "0102.2930"
        item["saleType"] = "Goods at Reduced Rate"
        item["rate"] = "1%"
        item["sroScheduleNo"] = "EIGHTH SCHEDULE Table 1"
        item["sroItemSerialNo"] = "82"
        item["salesTaxApplicable"] = 10

    payload["items"] = [item]
    scenarios[sn] = payload

results = []
print("Validating all 28 scenarios against FBR Gateway...")
for sn in sorted(scenarios.keys()):
    payload = scenarios[sn]
    ok, code, desc = validate_payload(payload)
    if ok:
        print(f"{sn}: VALID")
        results.append((sn, "VALID", ""))
    else:
        print(f"{sn}: FAILED ({code}) - {desc}")
        results.append((sn, f"FAILED ({code})", desc))
    time.sleep(0.3)

print("\n=== FINAL VALIDATION SUMMARY ===")
for sn, status, desc in results:
    err_text = f" - {desc}" if desc else ""
    print(f"[{sn}] Status: {status}{err_text}")
