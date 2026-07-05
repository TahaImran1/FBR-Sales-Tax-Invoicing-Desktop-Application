# **DI Scenarios Description for Sandbox Testing** 

**Disclaimer:** 

The information provided in this document is intended solely for the “Technical Specification for DI API” from PRAL. The contents of this document may not be reproduced or divulged outside the intended organizations without the express written permission of PRAL. 

**PAKISTAN REVENUE AUTOMATION (PVT.) LTD** 

PRAL – Head office, Software Technology Park-III, Plot No. 156, Service Road (North), Industrial Area, I-9/3, Islamabad. Pakistan 

## **Table of Content** 

|Scenarios for Sandbox Testing<br>SN001: Sale of Standard Rate Goods to Registered Buyers. ..................................................................... 3<br>SN002: Sale of Standard Rate Goods to Unregistered Buyers. ................................................................. 5<br>SN003: Sale of Steel (Melted and Re-Rolled) (Billets, Ingots and Long Bars). .......................................... 7<br>SN004: Sale of Steel Scrap by Ship Breakers: ............................................................................................ 9<br>SN005: Sales of Reduced Rate Goods (Eighth Schedule): ....................................................................... 11<br>SN006: Sale of Exempt Goods (Sixth Schedule): ..................................................................................... 13<br>SN007: Sale Of Zero-Rated Goods (Fifth Schedule): ............................................................................... 15<br>SN008: Sale of 3rd Schedule Goods: ....................................................................................................... 17<br>SN009: Purchase From Registered Cotton Ginners. ............................................................................... 19<br>SN010: Sale Of Telecom Services by Mobile Operators. ........................................................................ 21<br>SN011: Sale of Steel through Toll Manufacturing (Billets, Ingots and Long Bars). ................................. 23<br>SN012: Sale Of Petroleum Products. ...................................................................................................... 25<br>SN013: Sale Of Electricity to Retailers. ................................................................................................... 27<br>SN014: Sale of Gas to CNG Stations. ....................................................................................................... 29<br>SN015: Sale of Mobile Phones. ............................................................................................................... 31<br>SN016: Processing / Conversion of Goods. ............................................................................................. 33<br>SN017: Sale of Goods Where FED Is Charged in ST Mode. ..................................................................... 35<br>SN018: Sale Of Services Where FED Is Charged in ST Mode. .................................................................. 37<br>SN019: Sale of Services (as per ICT Ordinance). ..................................................................................... 39<br>SN020: Sale of Electric Vehicles. ............................................................................................................. 41<br>SN021: Sale of Cement /Concrete Block. ................................................................................................ 43<br>SN022: Sale of Potassium Chlorate. ........................................................................................................ 45<br>SN023: Sale of CNG. ................................................................................................................................ 47<br>SN024: Sale Of Goods Listed in SRO 297(1)/2023. ................................................................................. 49<br>SN025: Drugs Sold at Fixed ST Rate Under Serial 81 Of Eighth Schedule Table 1. ................................. 51<br>SN026: Sale Of Goods at Standard Rate to End Consumers by Retailers. .............................................. 53<br>SN027: Sale Of 3rd Schedule Goods to End Consumers by Retailers. .................................................... 55<br>SN028: Sale of Goods at Reduced Rate to End Consumers by Retailers. ............................................... 57|Scenarios for Sandbox Testing...................................................................................................................... 3<br>SN001: Sale of Standard Rate Goods to Registered Buyers. ..................................................................... 3<br>SN002: Sale of Standard Rate Goods to Unregistered Buyers. ................................................................. 5<br>SN003: Sale of Steel (Melted and Re-Rolled) (Billets, Ingots and Long Bars). .......................................... 7<br>SN004: Sale of Steel Scrap by Ship Breakers: ............................................................................................ 9<br>SN005: Sales of Reduced Rate Goods (Eighth Schedule): ....................................................................... 11<br>SN006: Sale of Exempt Goods (Sixth Schedule): ..................................................................................... 13<br>SN007: Sale Of Zero-Rated Goods (Fifth Schedule): ............................................................................... 15<br>SN008: Sale of 3rd Schedule Goods: ....................................................................................................... 17<br>SN009: Purchase From Registered Cotton Ginners. ............................................................................... 19<br>SN010: Sale Of Telecom Services by Mobile Operators. ........................................................................ 21<br>SN011: Sale of Steel through Toll Manufacturing (Billets, Ingots and Long Bars). ................................. 23<br>SN012: Sale Of Petroleum Products. ...................................................................................................... 25<br>SN013: Sale Of Electricity to Retailers. ................................................................................................... 27<br>SN014: Sale of Gas to CNG Stations. ....................................................................................................... 29<br>SN015: Sale of Mobile Phones. ............................................................................................................... 31<br>SN016: Processing / Conversion of Goods. ............................................................................................. 33<br>SN017: Sale of Goods Where FED Is Charged in ST Mode. ..................................................................... 35<br>SN018: Sale Of Services Where FED Is Charged in ST Mode. .................................................................. 37<br>SN019: Sale of Services (as per ICT Ordinance). ..................................................................................... 39<br>SN020: Sale of Electric Vehicles. ............................................................................................................. 41<br>SN021: Sale of Cement /Concrete Block. ................................................................................................ 43<br>SN022: Sale of Potassium Chlorate. ........................................................................................................ 45<br>SN023: Sale of CNG. ................................................................................................................................ 47<br>SN024: Sale Of Goods Listed in SRO 297(1)/2023. ................................................................................. 49<br>SN025: Drugs Sold at Fixed ST Rate Under Serial 81 Of Eighth Schedule Table 1. ................................. 51<br>SN026: Sale Of Goods at Standard Rate to End Consumers by Retailers. .............................................. 53<br>SN027: Sale Of 3rd Schedule Goods to End Consumers by Retailers. .................................................... 55<br>SN028: Sale of Goods at Reduced Rate to End Consumers by Retailers. ............................................... 57|
|---|---|



_Document Version :1.11 PRAL © 2025 – All rights reserved Page_ _**2** of_ _**58**_ 

## **SN001: Sale of Standard Rate Goods to Registered Buyers.** 

This applies to the sale of goods subject to the standard sales tax rate made to sales tax registered buyers. These buyers can usually claim input tax credits, allowing them to offset the tax paid on purchases against the tax due on their own sales. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-05-10", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerNTNCNIC":"8885801", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "2046004", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "", 

"scenarioId": "SN001", 

"buyerRegistrationType": "Registered", 

"items": [ 

{ 

"hsCode": "0101.2100", 

"productDescription": "test", 

"rate": "18%", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**3** of_ _**58**_ 

_Document Version :1.11_ 

"uoM": "Numbers, pieces, units", "quantity": 400, "totalValues": 0, "valueSalesExcludingST": 1000, 

"fixedNotifiedValueOrRetailPrice": 0.00, "salesTaxApplicable": 180, 

"salesTaxWithheldAtSource": 0, "extraTax": "", 

"furtherTax": 0, "sroScheduleNo": "", "fedPayable": 0, "discount": 0, "saleType": "Goods at standard rate (default)", 

"sroItemSerialNo": "" 

} 

] } 

_PRAL © 2025 – All rights reserved Page_ _**4** of_ _**58**_ 

_Document Version :1.11_ 

## **SN002: Sale of Standard Rate Goods to Unregistered Buyers.** 

When goods subject to the standard sales tax rate are sold to buyers who are not registered for sales tax (usually individual consumers or small businesses not registered for tax) the seller charges the full sales tax. Since the buyer is unregistered, they cannot claim input tax credits. This is often a business-toconsumer (B2C) sale. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-05-10", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerNTNCNIC":"8885801", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "1234567", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "", 

"scenarioId": "SN002", 

"buyerRegistrationType": "Unregistered", 

"items": [ 

{ 

"hsCode": "0101.2100", 

"productDescription": "test", 

"rate": "18%", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**5** of_ _**58**_ 

_Document Version :1.11_ 

"uoM": "Numbers, pieces, units", "quantity": 400, "totalValues": 0, "valueSalesExcludingST": 1000, 

"fixedNotifiedValueOrRetailPrice": 0.00, 

"salesTaxApplicable": 180, 

"salesTaxWithheldAtSource": 0, "extraTax": "", 

"furtherTax": 0, "sroScheduleNo": "", "fedPayable": 0, "discount": 0, "saleType": "Goods at standard rate (default)", 

"sroItemSerialNo": "" 

} 

] } 

_PRAL © 2025 – All rights reserved Page_ _**6** of_ _**58**_ 

_Document Version :1.11_ 

## **SN003: Sale of Steel (Melted and Re-Rolled) (Billets, Ingots and Long Bars).** 

The steel sector is governed by strict traceability and sector-specific rules. These goods are commonly traded by re-rollers and manufacturers. Tax authorities often regulate their tax treatment distinctly, sometimes applying specific tax rates or requiring compliance with additional notifications or schedules (like an SRO). 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-04-21", 

"sellerBusinessName": "Company 7", 

"sellerNTNCNIC": "8885801", 

"sellerProvince": "Sindh", 

"buyerNTNCNIC": "3710505701479", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"sellerAddress": "Karachi", 

"invoiceRefNo": "0", 

"scenarioId": "SN003", 

"buyerRegistrationType": "Unregistered", 

"items": [ 

{ 

"hsCode": "7214.1010", 

"productDescription": "", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**7** of_ _**58**_ 

_Document Version :1.11_ 

"rate": "18%", "uoM": "MT", "quantity": 1, "totalValues": 0, "valueSalesExcludingST": "205000.00", 

"fixedNotifiedValueOrRetailPrice": 0.00, "salesTaxApplicable": "36900", 

"salesTaxWithheldAtSource": 0, "extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "", "fedPayable": 0, "discount": 0, "saleType": "Steel melting and re-rolling", 

"sroItemSerialNo": "" 

} ] } 

_PRAL © 2025 – All rights reserved Page_ _**8** of_ _**58**_ 

_Document Version :1.11_ 

## **SN004: Sale of Steel Scrap by Ship Breakers:** 

Ship breakers dismantle old ships and recover scrap steel, which they then sell. This scrap steel is often treated separately for tax purposes, recognizing the different industry context. Special rates or exemptions might apply, and tax compliance is tailored to the ship-breaking sector. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-05-26", 

"sellerNTNCNIC": "4130276175937", 

"sellerBusinessName": "Company 8", 

"sellerAddress": "Karachi", 

"sellerProvince": "Sindh", 

"buyerNTNCNIC": "3710505701479", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "SI-20250421-001", 

"scenarioId": "SN004", 

"items": [ 

{ 

"hsCode": "7204.1010", 

"productDescription": "", 

"rate": "18%", 

"uoM": "MT", 

"quantity": 1, 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**9** of_ _**58**_ 

_Document Version :1.11_ 

"totalValues": 0, 

"valueSalesExcludingST": "175000", 

"salesTaxApplicable": "31500", 

"fixedNotifiedValueOrRetailPrice": 0, 

"salesTaxWithheldAtSource": 0, 

"extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "", 

"fedPayable": 0, "discount": 0, 

"saleType": "Ship breaking", 

"sroItemSerialNo": "" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**10** of_ _**58**_ 

_Document Version :1.11_ 

## **SN005: Sales of Reduced Rate Goods (Eighth Schedule):** 

Certain goods are taxed at a reduced sales tax rate (lower than the standard rate) to encourage affordability or protect consumers. The Eighth Schedule lists these goods commonly basic food items, medicines, or essential commodities. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-06-30", 

"sellerNTNCNIC": "8885801", 

"sellerBusinessName": "B2", 

"sellerAddress": "Karachi", 

"sellerProvince": "Sindh", 

"buyerNTNCNIC": "1000000000000", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "", 

"scenarioId": "SN005", 

"buyerRegistrationType": "Unregistered", 

"items": [ 

{ 

"hsCode": "0102.2930", 

"productDescription": "product Description41", 

"rate": "1%", 

_PRAL © 2025 – All rights reserved Page_ _**11** of_ _**58**_ 

_Document Version :1.11_ 

"uoM": "Numbers, pieces, units", "quantity": 1.0000, "totalValues": 0.00, "valueSalesExcludingST": 1000.00, 

"fixedNotifiedValueOrRetailPrice": 0.00, 

"salesTaxApplicable": 10, 

"salesTaxWithheldAtSource": 50.23, "extraTax": "", 

"furtherTax": 120.00, 

"sroScheduleNo": "EIGHTH SCHEDULE Table 1", "fedPayable": 50.36, "discount": 56.36, 

"saleType": "Goods at Reduced Rate", 

"sroItemSerialNo": "82" 

} ] } 

_PRAL © 2025 – All rights reserved Page_ _**12** of_ _**58**_ 

_Document Version :1.11_ 

## **SN006: Sale of Exempt Goods (Sixth Schedule):** 

Goods listed in the Sixth Schedule are exempt from sales tax, meaning sellers do not charge sales tax on these goods. This exemption is usually to reduce the tax burden on essential or socially important items, such as certain agricultural products, medicines, or basic necessities. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-07-01", 

"sellerBusinessName": "Company 8", 

"sellerNTNCNIC": "8885801", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "2046004", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "SI-20250515-001", 

"scenarioId": "SN006", 

"buyerRegistrationType": "Registered", 

"items": [ 

{ "hsCode": "0102.2930", 

"productDescription": "product Description41", 

"rate": "Exempt", 

"uoM": "Numbers, pieces, units", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**13** of_ _**58**_ 

_Document Version :1.11_ 

"quantity": 1.0000, 

"totalValues": 0.00, 

"valueSalesExcludingST": 10, 

"fixedNotifiedValueOrRetailPrice": 0.00, 

"salesTaxApplicable": 0, 

"salesTaxWithheldAtSource": 50.23, "extraTax": "", 

"furtherTax": 120.00, 

"sroScheduleNo": "6th Schd Table I", 

"fedPayable": 50.36, "discount": 56.36, 

"saleType": "Exempt goods", 

"sroItemSerialNo": "100" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**14** of_ _**58**_ 

_Document Version :1.11_ 

## **SN007: Sale Of Zero-Rated Goods (Fifth Schedule):** 

Zero-rated goods are those on which sales tax is charged at **0%** . While the seller does not charge sales tax to the buyer, the seller can claim input tax credits on purchases related to these goods. This is often applied to exported goods or specific industries to promote exports and reduce tax layering. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-04-21", 

"sellerBusinessName": "Company 7", 

"sellerNTNCNIC": "8885801", 

"sellerProvince": "Sindh", 

"buyerNTNCNIC": "3710505701479", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"sellerAddress": "Karachi", 

"scenarioId": "SN007", 

"buyerRegistrationType": "Unregistered", 

"invoiceRefNo": "0", 

"items": [ 

{ "hsCode": "0101.2100", 

"productDescription": "test", 

"rate": "0%", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**15** of_ _**58**_ 

_Document Version :1.11_ 

"uoM": "Numbers, pieces, units", "quantity": 100, "totalValues": 0, "valueSalesExcludingST": 100, "salesTaxApplicable": 0, 

"salesTaxWithheldAtSource": 0, "extraTax": 0, 

"furtherTax": 0, "sroScheduleNo": "327(I)/2008", "fixedNotifiedValueOrRetailPrice": 0.00, 

"fedPayable": 0, "discount": 0, "saleType": "Goods at zero-rate", 

"sroItemSerialNo": "1" 

} ] } 

_PRAL © 2025 – All rights reserved Page_ _**16** of_ _**58**_ 

_Document Version :1.11_ 

## **SN008: Sale of 3rd Schedule Goods:** 

Items listed under the Third Schedule are subject to sales tax on the basis of their printed retail price rather than the transaction value. In such cases, manufacturers or importers are responsible for paying sales tax at the point of production or import, not at the point of sale. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-04-21", 

"sellerNTNCNIC": "8885801", 

"sellerBusinessName": "Company 7", 

"sellerProvince": "Sindh", 

"buyerNTNCNIC": "3710505701479", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"sellerAddress": "Karachi", 

"invoiceRefNo": "0", 

"scenarioId": "SN008", 

"buyerRegistrationType": "Unregistered", 

"items": [ 

{ "hsCode": "0101.2100", 

"productDescription": "test", 

"rate": "18%", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**17** of_ _**58**_ 

_Document Version :1.11_ 

"uoM": "Numbers, pieces, units", 

"quantity": 100, 

"totalValues": 145, 

"valueSalesExcludingST": 0, 

"fixedNotifiedValueOrRetailPrice": 1000, 

"salesTaxApplicable": 180, 

"salesTaxWithheldAtSource": 0, "extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "", 

"fedPayable": 0, "discount": 0, 

"saleType": "3rd Schedule Goods", 

"sroItemSerialNo": "" 

} 

] } 

_PRAL © 2025 – All rights reserved Page_ _**18** of_ _**58**_ 

_Document Version :1.11_ 

## **SN009: Purchase From Registered Cotton Ginners.** 

Purchases from registered cotton ginners, subject to specific rules under cotton trade taxation. May involve reverse charge or input tax mechanisms. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-05-15", 

"sellerNTNCNIC": "8885801", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "2046004", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "", 

"scenarioId": "SN009", 

"buyerRegistrationType": "Registered", //Register Buyer only 

"items": [ 

{ 

"hsCode": "0101.2100", 

"productDescription": "test", 

"rate": "18%", 

"uoM": "Numbers, pieces, units", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**19** of_ _**58**_ 

_Document Version :1.11_ 

"quantity": 0, 

"totalValues": 2500, 

"valueSalesExcludingST": 2500, 

"fixedNotifiedValueOrRetailPrice": 0.00, 

"salesTaxApplicable": 450, 

"salesTaxWithheldAtSource": 0, "extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "", 

"fedPayable": 0, "discount": 0, 

"saleType": "Cotton ginners", 

"sroItemSerialNo": "" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**20** of_ _**58**_ 

_Document Version :1.11_ 

## **SN010: Sale Of Telecom Services by Mobile Operators.** 

Mobile operators provide telecom services (calls, data, SMS). These services are typically taxed under specific rules separate from goods, sometimes including additional regulatory fees. Invoices must account for both FED and GST, possibly varying by province. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-05-15", 

"sellerBusinessName": "Company 8", 

"sellerNTNCNIC": "8885801", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "1000000000000", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "SI-20250515-001", 

"scenarioId": "SN010", 

"buyerRegistrationType": "Unregistered", 

"items": [ 

{ "hsCode": "0101.2100", 

"productDescription": "test", 

"rate": "17%", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**21** of_ _**58**_ 

_Document Version :1.11_ 

"uoM": "Numbers, pieces, units", "quantity": 1000, "totalValues": 0, "valueSalesExcludingST": 100, "fixedNotifiedValueOrRetailPrice": 0.00, "salesTaxApplicable": 17, 

"salesTaxWithheldAtSource": 0, "extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "", // If not applicable, leave empty "fedPayable": 0, "discount": 0, 

"saleType": "Telecommunication services", 

"sroItemSerialNo": "" // If not applicable, leave empty 

} ] } 

_PRAL © 2025 – All rights reserved Page_ _**22** of_ _**58**_ 

_Document Version :1.11_ 

## **SN011: Sale of Steel through Toll Manufacturing (Billets, Ingots and Long Bars).** 

Toll manufacturing involves a third-party processing raw steel into finished billets, ingots, or long bars on behalf of another business. The processor issues an invoice for conversion charges (service), while the principal may generate a separate invoice for the actual product sale. The sales tax treatment can differ because ownership and processing roles are split. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-05-26", 

"sellerNTNCNIC": "4130276175937", 

"sellerBusinessName": "Company 8", 

"sellerAddress": "Karachi", 

"sellerProvince": "Sindh", 

"buyerNTNCNIC": "3710505701479", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "", 

"dataSource": "", 

"scenarioId": "SN011", 

"items": [ 

{ 

"hsCode": "7214.9990", 

"productDescription": "", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**23** of_ _**58**_ 

_Document Version :1.11_ 

"rate": "18%", "uoM": "MT", "quantity": 1, "totalValues": 0, "valueSalesExcludingST": "205000", "salesTaxApplicable": "36900", 

"fixedNotifiedValueOrRetailPrice": 0, 

"salesTaxWithheldAtSource": 0, "extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "", "fedPayable": 0, "discount": 0, "saleType": "Toll Manufacturing", 

"sroItemSerialNo": "" 

} ] } 

_PRAL © 2025 – All rights reserved Page_ _**24** of_ _**58**_ 

_Document Version :1.11_ 

## **SN012: Sale Of Petroleum Products.** 

Petroleum products like petrol, diesel, or lubricants often have distinct sales tax rates or are subject to federal excise duties due to their economic and environmental importance. These products may also have multiple layers of tax or additional regulatory levies. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-05-15", 

"sellerNTNCNIC": "8885801", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "1000000000000", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "SI-20250515-001", 

"scenarioId": "SN012", 

"buyerRegistrationType":"Unregistered", 

"items": [ 

{ "hsCode": "0101.2100", 

"productDescription": "TEST", 

"rate": "1.43%", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**25** of_ _**58**_ 

_Document Version :1.11_ 

"uoM": "Numbers, pieces, units", 

"quantity": 123, 

"totalValues": 132, 

"valueSalesExcludingST": 100, 

"fixedNotifiedValueOrRetailPrice": 0.00, 

"salesTaxApplicable": 1.43, 

"salesTaxWithheldAtSource": 2, "extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "1450(I)/2021", 

"fedPayable": 0, "discount": 0, 

"saleType": "Petroleum Products", 

"sroItemSerialNo": "4" 

} 

] } 

_PRAL © 2025 – All rights reserved Page_ _**26** of_ _**58**_ 

_Document Version :1.11_ 

## **SN013: Sale Of Electricity to Retailers.** 

Selling electricity to retailers who distribute to end consumers can have unique tax implications. Sales tax or federal excise duty might be applied differently depending on whether the electricity is sold wholesale or retail, with some exemptions for consumers. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-05-15", 

"sellerNTNCNIC": "8885801", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "1000000000000", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "SI-20250515-001", 

"scenarioId": "SN013", 

"buyerRegistrationType": "Unregistered", 

"items": [ 

{ "hsCode": "0101.2100", 

"productDescription": "TEST", 

"rate": "5%", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**27** of_ _**58**_ 

_Document Version :1.11_ 

"uoM": "Numbers, pieces, units", "quantity": 123, "totalValues": 212, "valueSalesExcludingST": 1000, "fixedNotifiedValueOrRetailPrice": 0.00, 

"salesTaxApplicable": 50, 

"salesTaxWithheldAtSource": 11, "extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "1450(I)/2021", "fedPayable": 0, "discount": 0, 

"saleType": "Electricity Supply to Retailers", 

"sroItemSerialNo": "4" 

} 

] } 

_PRAL © 2025 – All rights reserved Page_ _**28** of_ _**58**_ 

_Document Version :1.11_ 

## **SN014: Sale of Gas to CNG Stations.** 

Natural gas sold to CNG (Compressed Natural Gas) filling stations may have special tax treatment to promote cleaner fuels or regulate the energy sector. The tax rate and compliance requirements can differ from other gas sales. 

{ 

"invoiceType": "Sale Invoice", "invoiceDate": "2025-05-15", "sellerNTNCNIC": "8885801", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", "buyerNTNCNIC": "1000000000000", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "SI-20250515-001", 

"scenarioId": "SN014", 

"buyerRegistrationType": "Unregistered", 

"items": [ 

{ 

"hsCode": "0101.2100", 

"productDescription": "TEST", "rate": "18%", 

"uoM": "Numbers, pieces, units", 

"quantity": 123, 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**29** of_ _**58**_ 

_Document Version :1.11_ 

"totalValues": 0, 

"valueSalesExcludingST": 1000, 

"salesTaxApplicable": 180, 

"salesTaxWithheldAtSource": 0, 

"fixedNotifiedValueOrRetailPrice": 0, 

"extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "", 

"fedPayable": 0, "discount": 0, 

"saleType": "Gas to CNG stations", 

"sroItemSerialNo": "" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**30** of_ _**58**_ 

_Document Version :1.11_ 

## **SN015: Sale of Mobile Phones.** 

Sales of mobile handsets often attract standard sales tax but might be subject to additional duties or regulatory charges, especially given the value of these goods. Governments sometimes adjust tax rates on mobile phones to encourage or discourage imports. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-05-15", 

"sellerBusinessName": "Company 8", 

"sellerNTNCNIC": "8885801", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "1000000000000", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "SI-20250515-001", 

"scenarioId": "SN015", 

"buyerRegistrationType": "Unregistered", 

"additional1": "", 

"additional2": "", 

"additional3": "", 

"items": [ 

{ 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**31** of_ _**58**_ 

_Document Version :1.11_ 

"hsCode": "0101.2100", 

"productDescription": "TEST", "rate": "18%", 

"uoM": "Numbers, pieces, units", "quantity": 123, "totalValues": 0, "valueSalesExcludingST": 1234, "salesTaxApplicable": 222.12, 

"salesTaxWithheldAtSource": 0, 

"fixedNotifiedValueOrRetailPrice": 0, "extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "NINTH SCHEDULE", 

"fedPayable": 0, "discount": 0, 

"saleType": "Mobile Phones", 

"sroItemSerialNo": "1(A)" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**32** of_ _**58**_ 

_Document Version :1.11_ 

## **SN016: Processing / Conversion of Goods.** 

This refers to services where raw materials or semi-finished goods are converted into finished products through manufacturing or processing. It involves charging for the value-added process (like dyeing, packaging, machining), not the goods themselves. Sales tax on such services can differ from that on goods sales. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-05-16", 

"sellerNTNCNIC": "8885801", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "1000000000078", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "", 

"scenarioId": "SN016", 

"buyerRegistrationType": "Unregistered", 

"items": [ 

{ 

"hsCode": "0101.2100", 

"productDescription": "test", 

"rate": "5%", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**33** of_ _**58**_ 

_Document Version :1.11_ 

"uoM": "Numbers, pieces, units", 

"quantity": 1, 

"totalValues": 0, 

"valueSalesExcludingST": 100, 

"salesTaxApplicable": 5, 

"salesTaxWithheldAtSource": 0, 

"fixedNotifiedValueOrRetailPrice": 0, 

"extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "", 

"fedPayable": 0, 

"discount": 0, 

"saleType": "Processing/Conversion of Goods", 

"sroItemSerialNo": "" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**34** of_ _**58**_ 

_Document Version :1.11_ 

## **SN017: Sale of Goods Where FED Is Charged in ST Mode.** 

Federal Excise Duty (FED) may be charged alongside sales tax, but in some cases, FED is collected through the sales tax system (“ST mode”). This means the seller includes FED in the sales tax invoice, streamlining collection. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-05-10", 

"sellerNTNCNIC": "8885801", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "7000009", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "", 

"scenarioId": "SN017", 

"buyerRegistrationType": "Unregistered", 

"items": [ 

{ 

"hsCode": "0101.2100", 

"productDescription": "TEST", 

"rate": "8%", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**35** of_ _**58**_ 

_Document Version :1.11_ 

"uoM": "Numbers, pieces, units", 

"quantity": 1, 

"valueSalesExcludingST": 100, 

"fixedNotifiedValueOrRetailPrice": 0, 

"salesTaxApplicable": 8, 

"salesTaxWithheldAtSource": 0, 

"extraTax": 0, 

"furtherTax": 0, 

"fedPayable": 0, "discount": 0, 

"totalValues": 0, 

"saleType": "Goods (FED in ST Mode)", 

"sroScheduleNo": "", 

"sroItemSerialNo": "" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**36** of_ _**58**_ 

_Document Version :1.11_ 

## **SN018: Sale Of Services Where FED Is Charged in ST Mode.** 

Certain services (e.g., advertisement, franchise, insurance) are liable to FED but invoiced under the sales tax framework. This allows FBR to monitor service sector revenue streams without requiring separate returns for FED and sales tax. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-06-14", 

"sellerNTNCNIC": "8885801", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "1000000000056", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "SI-20250421-001", 

"scenarioId": "SN018", 

"buyerRegistrationType": "Unregistered", 

"items": [ 

{ 

"hsCode": "0101.2100", 

"productDescription": "TEST", 

"rate": "8%", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**37** of_ _**58**_ 

_Document Version :1.11_ 

"uoM": "Numbers, pieces, units", 

"quantity": 20, 

"totalValues": 0, 

"valueSalesExcludingST": 1000, 

"salesTaxApplicable": 80, 

"fixedNotifiedValueOrRetailPrice": 0, 

"salesTaxWithheldAtSource": 0, 

"extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "", 

"fedPayable": 0, 

"discount": 0, 

"saleType": "Services (FED in ST Mode)", 

"sroItemSerialNo": "" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**38** of_ _**58**_ 

_Document Version :1.11_ 

## **SN019: Sale of Services (as per ICT Ordinance).** 

Businesses providing services such as consultancy, software development, and IT solutions in ICT are taxed under a distinct ordinance. This can include variations in rates or exemptions. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-04-21", 

"sellerNTNCNIC": "8885801", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "1000000000000", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "SI-20250421-001", 

"buyerRegistrationType": "Unregistered", 

"scenarioId": "SN019", 

"items": [ 

{ 

"hsCode": "0101.2900", 

"productDescription": "TEST", 

"rate": "5%", 

"uoM": "Numbers, pieces, units", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**39** of_ _**58**_ 

_Document Version :1.11_ 

"quantity": 1, 

"totalValues": 0, 

"valueSalesExcludingST": 100, 

"salesTaxApplicable": 5, 

"fixedNotifiedValueOrRetailPrice": 0, 

"salesTaxWithheldAtSource": 0, 

"extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "ICTO TABLE I", 

"fedPayable": 0, 

"discount": 0, 

"saleType": "Services", 

"sroItemSerialNo": "1(ii)(ii)(a)" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**40** of_ _**58**_ 

_Document Version :1.11_ 

## **SN020: Sale of Electric Vehicles.** 

Electric vehicles may be incentivized through reduced sales tax rates or exemptions to encourage environmentally friendly transportation. Invoices must categorize these vehicles distinctly (not as hybrids or combustion), and declare engine/battery specs to validate tax benefits. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-04-21", 

"sellerNTNCNIC": "8885801", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "1000000000000", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"buyerRegistrationType": "Unregistered", 

"scenarioId": "SN020", 

"invoiceRefNo": "SI-20250421-001", 

"items": [ 

{ 

"hsCode": "0101.2900", 

"productDescription": "TEST", 

"rate": "1%", 

"uoM": "Numbers, pieces, units", 

"quantity": 122, 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**41** of_ _**58**_ 

_Document Version :1.11_ 

"totalValues": 0, 

"valueSalesExcludingST": 1000, 

"fixedNotifiedValueOrRetailPrice": 0, 

"salesTaxApplicable": 10, 

"salesTaxWithheldAtSource": 0, 

"extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "6th Schd Table III", 

"fedPayable": 0, "discount": 0, 

"saleType": "Electric Vehicle", 

"sroItemSerialNo": "20" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**42** of_ _**58**_ 

_Document Version :1.11_ 

## **SN021: Sale of Cement /Concrete Block.** 

Cement and concrete blocks are taxed at the standard rate and are subject to strict regulation due to their environmental impact and role in construction. These products are also subject to input-output ratios tracking due construction regulations. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-04-21", 

"sellerNTNCNIC": "8885801", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "1000000000000", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "SI-20250421-001", 

"buyerRegistrationType": "Unregistered", 

"scenarioId": "SN021", 

"items": [ 

{ 

"hsCode": "0101.2100", 

"productDescription": "TEST", 

"rate": "Rs.3", 

"uoM": "Numbers, pieces, units", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**43** of_ _**58**_ 

_Document Version :1.11_ 

"quantity": 12, 

"totalValues": 0, 

"valueSalesExcludingST": 123, 

"salesTaxApplicable": 36, 

"fixedNotifiedValueOrRetailPrice":0, 

"salesTaxWithheldAtSource": 0, 

"extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "", 

"fedPayable": 0, 

"discount": 0, 

"saleType": "Cement /Concrete Block", 

"sroItemSerialNo": "" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**44** of_ _**58**_ 

_Document Version :1.11_ 

## **SN022: Sale of Potassium Chlorate.** 

Potassium chlorate is a sensitive chemical used primarily in matchstick manufacturing and regulated under special rules. It is subject to fixed tax per kilogram (weight) rather than value. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-04-21", 

"sellerNTNCNIC": "8885801", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "1000000000000", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"buyerRegistrationType": "Unregistered", 

"scenarioId": "SN022", 

"invoiceRefNo": "SI-20250421-001", 

"items": [ 

{ 

"hsCode": "3104.2000", 

"productDescription": "TEST", 

"rate": "18% along with rupees 60 per kilogram", 

"uoM": "KG", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**45** of_ _**58**_ 

_Document Version :1.11_ 

"quantity": 1, 

"totalValues": 0, 

"valueSalesExcludingST": 100, 

"fixedNotifiedValueOrRetailPrice": 0, 

"salesTaxApplicable": 78, 

"salesTaxWithheldAtSource": 0, 

"extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "EIGHTH SCHEDULE Table 1", 

"fedPayable": 0, 

"discount": 0, 

"saleType": "Potassium Chlorate", 

"sroItemSerialNo": "56" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**46** of_ _**58**_ 

_Document Version :1.11_ 

## **SN023: Sale of CNG.** 

Sales of Compressed Natural Gas involve regulated pricing structures and specific tax treatments that may include both FED and sales tax. CNG stations must issue invoices for every sale, indicating the volume sold, tax applied, and billing rates. These transactions are generally high-frequency and often managed via automated dispensing and billing systems. 

{ 

"invoiceType": "Sale Invoice", "invoiceDate": "2025-04-21", 

"sellerNTNCNIC": "8885801", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "1000000000000", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"buyerRegistrationType": "Unregistered", 

"scenarioId": "SN023", 

"invoiceRefNo": "SI-20250421-001", 

"items": [ 

{ 

"hsCode": "0101.2100", 

"productDescription": "TEST", 

"rate": "Rs.200", 

"uoM": "Numbers, pieces, units", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**47** of_ _**58**_ 

_Document Version :1.11_ 

"quantity": 123, 

"totalValues": 0, 

"valueSalesExcludingST": 234, 

"fixedNotifiedValueOrRetailPrice": 0, 

"salesTaxApplicable": 24600, 

"salesTaxWithheldAtSource": 0, "extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "581(1)/2024", 

"fedPayable": 0, "discount": 0, 

"saleType": "CNG Sales", 

"sroItemSerialNo": "Region-I" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**48** of_ _**58**_ 

_Document Version :1.11_ 

## **SN024: Sale Of Goods Listed in SRO 297(1)/2023.** 

This SRO notifies specific goods subject to reduced, conditional, or fixed-rate taxation. These may include solar equipment, medical devices, or energy-efficient appliances may include solar equipment, medical devices, or energy-efficient appliances. Businesses dealing in such goods must identify the correct serial numbers and apply appropriate tax treatments in their invoices. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-04-21", 

"sellerNTNCNIC": "8885801", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "1000000000000", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"buyerRegistrationType": "Unregistered", 

"scenarioId": "SN024", 

"invoiceRefNo": "SI-20250421-001", 

"items": [ 

{ 

"hsCode": "0101.2100", 

"productDescription": "TEST", 

"rate": "25%", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**49** of_ _**58**_ 

_Document Version :1.11_ 

"uoM": "Numbers, pieces, units", 

"quantity": 123, 

"totalValues": 0, 

"valueSalesExcludingST": 1000, 

"fixedNotifiedValueOrRetailPrice": 0, 

"salesTaxApplicable": 250, 

"salesTaxWithheldAtSource": 0, 

"extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "297(I)/2023-Table-I", 

"fedPayable": 0, 

"discount": 0, 

"saleType": "Goods as per SRO.297(|)/2023", 

"sroItemSerialNo": "12" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**50** of_ _**58**_ 

_Document Version :1.11_ 

## **SN025: Drugs Sold at Fixed ST Rate Under Serial 81 Of Eighth Schedule Table 1.** 

Certain pharmaceutical products are taxed at a fixed sales tax rate under serial 81 of the Eighth Schedule. These rates are often lower to make medicines affordable, and the fixed rate means the tax is a set amount or percentage regardless of price variations. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-05-16", 

"sellerNTNCNIC": "8885801", 

"sellerBusinessName": "Company 8", 

"sellerAddress": "Karachi", 

"sellerProvince": "Sindh", 

"buyerNTNCNIC": "1000000000078", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"buyerRegistrationType": "Unregistered", 

"invoiceRefNo": "", 

"scenarioId": "SN025", 

"items": [ 

{ 

"hsCode": "0101.2100", 

"productDescription": "TEST", 

"rate": "0%", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**51** of_ _**58**_ 

_Document Version :1.11_ 

"uoM": "Numbers, pieces, units", "quantity": 1, "totalValues": 0, "valueSalesExcludingST": 100, "fixedNotifiedValueOrRetailPrice": 0, "salesTaxApplicable": 0, 

"salesTaxWithheldAtSource": 0, "extraTax": "", 

"furtherTax": 0, 

"sroScheduleNo": "EIGHTH SCHEDULE Table 1", "fedPayable": 0, "discount": 0, 

"saleType": "Non-Adjustable Supplies", "sroItemSerialNo": "81" 

} ] } 

_PRAL © 2025 – All rights reserved Page_ _**52** of_ _**58**_ 

_Document Version :1.11_ 

## **SN026: Sale Of Goods at Standard Rate to End Consumers by Retailers.** 

Retailers selling taxable goods directly to end consumers must apply the standard rate of sales tax at the point of sale. These transactions are typically conducted through Point-of-Sale (POS) systems integrated with FBR's IRIS platform. Since consumers are typically unregistered, retailers collect the tax without input tax credit implications. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-05-16", 

"sellerNTNCNIC": "7000008", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "1000000000078", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"buyerRegistrationType": "Registered", 

"scenarioId": "SN026", 

"invoiceRefNo": "SI-20250421-001", 

"items": [ 

{ 

"hsCode": "0101.2100", 

"productDescription": "TEST", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**53** of_ _**58**_ 

_Document Version :1.11_ 

"rate": "18%", 

"uoM": "Numbers, pieces, units", 

"quantity": 123, 

"totalValues": 0, 

"valueSalesExcludingST": 1000, 

"fixedNotifiedValueOrRetailPrice": 0, 

"salesTaxApplicable": 180, 

"salesTaxWithheldAtSource": 0, 

"extraTax": 0, 

"furtherTax": 0, 

"sroScheduleNo": "", 

"fedPayable": 0, "discount": 0, 

"saleType": "Goods at standard rate (default)", 

"sroItemSerialNo": "" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**54** of_ _**58**_ 

_Document Version :1.11_ 

## **SN027: Sale Of 3rd Schedule Goods to End Consumers by Retailers.** 

Retailers selling goods under the 3rd Schedule, such as branded FMCGs, must charge and report sales tax based on the maximum retail price (MRP), not the transactional or discounted. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-05-10", 

"sellerNTNCNIC": "7000008", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "7000006", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"buyerRegistrationType": "Registered", 

"invoiceRefNo": "", 

"scenarioId": "SN027", 

"items": [ 

{ 

"hsCode": "0101.2100", 

"productDescription": "test", 

"rate": "18%", 

"uoM": "Numbers, pieces, units", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**55** of_ _**58**_ 

_Document Version :1.11_ 

"quantity": 1, 

"totalValues": 0, 

"valueSalesExcludingST": 0, 

"fixedNotifiedValueOrRetailPrice": 100, 

"salesTaxApplicable": 18, 

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

_PRAL © 2025 – All rights reserved Page_ _**56** of_ _**58**_ 

_Document Version :1.11_ 

## **SN028: Sale of Goods at Reduced Rate to End Consumers by Retailers.** 

Certain essential goods, such as baby milk and books, are subject to a reduced tax rate lower than the standard 18% when sold to end consumers. This preferential rate is intended to keep vital or socially important products affordable. Retailers selling such goods must ensure that the products are correctly classified under the applicable tax schedule to qualify for the reduced rate. 

{ 

"invoiceType": "Sale Invoice", 

"invoiceDate": "2025-05-16", 

"sellerNTNCNIC": "7000008", 

"sellerBusinessName": "Company 8", 

"sellerProvince": "Sindh", 

"sellerAddress": "Karachi", 

"buyerNTNCNIC": "1000000000000", 

"buyerBusinessName": "FERTILIZER MANUFAC IRS NEW", 

"buyerProvince": "Sindh", 

"buyerAddress": "Karachi", 

"invoiceRefNo": "", 

"buyerRegistrationType": "Registered", 

"scenarioId": "SN028", 

"items": [ 

{ 

"hsCode": "0101.2100", 

"productDescription": "TEST", 

"rate": "1%", 

_PRAL © 2025 – All rights reserved_ 

_Page_ _**57** of_ _**58**_ 

_Document Version :1.11_ 

"uoM": "Numbers, pieces, units", 

"quantity": 0, 

"totalValues": 0, 

"valueSalesExcludingST": 0, 

"fixedNotifiedValueOrRetailPrice": 100, 

"salesTaxApplicable": 0, 

"salesTaxWithheldAtSource": 0, 

"extraTax": "", 

"furtherTax": 0, 

"sroScheduleNo": "EIGHTH SCHEDULE Table 1", 

"fedPayable": 0, "discount": 0, 

"saleType": "Goods at Reduced Rate", 

"sroItemSerialNo": "70" 

} 

] 

} 

_PRAL © 2025 – All rights reserved Page_ _**58** of_ _**58**_ 

_Document Version :1.11_ 

