# 02 — Floor Plan: Branch B1 "السوق المركزي / Central Market"

Human-readable description. The machine source of truth is the `FLOORPLAN` object inside `03-generate-data.mjs`, which writes `public/data/floorplan.json`. If this doc and the script disagree, the script wins.

## Geometry

- Footprint 60 m (x) × 30 m (y), two floors. Coordinates in metres, origin top-left, x → right, y → down.
- Street / main frontage is the **bottom edge (y = 30)**. Parking is on the **right edge (x = 60)**. Service yard is on the **top-left (x = 0, y = 0)**.
- SVG `viewBox="0 0 60 30"` for both floors.

## Ground floor (G)

| Zone | id | x | y | w | h | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Main entrance | `ENT-MAIN` | 26 | 29 | 8 | 1 | 8 m double sliding doors |
| Vestibule / trolleys | `VEST` | 24 | 26 | 12 | 3 | baskets, trolley bay at x 47–52 |
| Parking entrance | `ENT-PARK` | 59 | 22 | 1 | 5 | right wall |
| Staff entrance + biometric | `ENT-STAFF` | 0 | 12 | 1 | 2 | left wall, fingerprint device `BIO-G1` |
| Checkout lanes ×8 | `POS-01` … `POS-08` | 4 + 2.5·i | 24 | 2 | 3 | i = 0..7; lanes 7–8 normally closed |
| Self-checkout ×4 | `SCO` | 42 | 25 | 4 | 3 | |
| Customer service / returns | `CS` | 36 | 25 | 6 | 3 | refund approvals happen here |
| Escalator up | `ESC-UP` | 28 | 11 | 1.5 | 8 | |
| Escalator down | `ESC-DN` | 30.5 | 11 | 1.5 | 8 | |
| Receiving dock + warehouse | `WH-01` | 0 | 0 | 12 | 10 | dock door x 0–3; blind receiving here |
| Cold store | `WH-COLD` | 12 | 0 | 4 | 5 | |
| Offices / staff room | `OFF` | 0 | 10 | 6 | 6 | |
| Wall chillers (dairy, juices) | `CH-01` … `CH-07` | 16 + 4·i | 0 | 4 | 2 | i = 0..6 |
| Freezers | `FR-01` … `FR-03` | 44 + 4.6·i | 0 | 4.6 | 2 | i = 0..2 |
| Deli & cheese counter | `DELI` | 44 | 3 | 8 | 5 | |
| Bakery counter | `BAK` | 52 | 3 | 8 | 6 | |
| Cross aisle (centre) | — | 26 | 4 | 8 | 18 | around escalators |
| Front aisle | — | 4 | 22.2 | 52 | 1.8 | between gondolas and checkouts |

### Gondolas

Six rows (A01 nearest the chillers, A06 nearest the checkouts). Each row has a left block (x 6–26) and a right block (x 34–56), 1.2 m deep, with a 2.2 m aisle between rows (pitch 3.4 m). Each block is split into two bays of equal length. End-caps face the centre cross aisle and the outer aisles.

| Row | y | Category (AR / EN) |
| --- | --- | --- |
| A01 | 4.0 | مشروبات ومياه / Beverages & water |
| A02 | 7.4 | وجبات خفيفة وحلويات / Snacks & confectionery |
| A03 | 10.8 | أرز ومعكرونة وزيوت ومعلبات / Rice, pasta, oils, canned |
| A04 | 14.2 | منظفات وأدوات منزلية / Household & cleaning |
| A05 | 17.6 | عناية شخصية وأطفال / Personal care & baby |
| A06 | 21.0 | شاي وقهوة وتمور وعروض / Tea, coffee, dates & promos |

Fixture ids: `A03-L1`, `A03-L2` (left bays), `A03-R1`, `A03-R2` (right bays), `A03-END-W` (west end of left block, x 5–6), `A03-END-C1` (left block end facing centre, x 26–27), `A03-END-C2` (right block end facing centre, x 33–34), `A03-END-E` (east end, x 56–57). Each bay has 5 levels (`L1` bottom … `L5` top); level 3 is eye level and priced highest for supplier reservations.

Prime positions (highest shelf rent): all `END-C*` end-caps (face the escalator cross aisle), `A06-*` level 3 (last row before checkout), `CH-03`/`CH-04` (dairy, highest traffic).

**Planted story — "the second shelf":** `A02-END-C2` (snacks end-cap facing the escalators) is reserved by supplier `SUP-04 شركة الوجبات الخليجية` at 180.000 KD/month; contract ends **45 days after the demo date**. Its traffic score is in the top 5 of the branch but its sales per metre are below the branch median → agent recommends renewing at a higher price or opening it to other suppliers now (see `05-SCENARIOS.md` #8).

## Mezzanine (M)

Open void over the escalators: x 24–36, y 9–21. A 4 m corridor runs around the void; shops line the perimeter.

| id | x | y | w | h | Area m² | Shop (AR / EN) | Type | Status (demo) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `M-01` | 0 | 0 | 10 | 7 | 70 | مكتبة مدرسية / School Stationery & Books | shop | leased |
| `M-02` | 10 | 0 | 8 | 7 | 56 | محل ألعاب / Toy Store | shop | leased |
| `M-03` | 18 | 0 | 10 | 7 | 70 | محل كشتات / Camping & Outdoor | shop | expiring (75 d) |
| `M-04` | 28 | 0 | 8 | 7 | 56 | محل موبايلات / Mobiles & Accessories | shop | leased |
| `M-05` | 36 | 0 | 9 | 7 | 63 | ملابس رياضية / Sportswear | shop | leased |
| `M-06` | 45 | 0 | 7 | 7 | 49 | عطار / Attar & Herbs | shop | leased |
| `M-07` | 52 | 0 | 8 | 7 | 56 | صرافة / Currency Exchange | shop | **arrears 45 d** |
| `M-08` | 0 | 23 | 7 | 7 | 49 | حلاق أطفال / Kids Barber | shop | leased |
| `M-09` | 7 | 23 | 12 | 7 | 84 | مقهى / Café | shop | leased |
| `M-10` | 19 | 23 | 6 | 7 | 42 | خياط / Tailor | shop | leased |
| `L-01` | 25 | 23 | 10 | 7 | 70 | بهو الفعاليات / Event Lobby | lobby | bookable by day |
| `M-11` | 35 | 23 | 10 | 7 | 70 | أدوات منزلية / Housewares | shop | leased |
| `M-12` | 45 | 23 | 8 | 7 | 56 | صيدلية / Pharmacy | shop | leased |
| `M-13` | 53 | 23 | 7 | 7 | 49 | مغسلة / Laundry | shop | reserved |
| `M-14` | 0 | 7 | 7 | 8 | 56 | نظارات / Optics | shop | leased |
| `SVC` | 0 | 15 | 7 | 8 | — | دورات مياه ومصلى / WC & prayer room | service | — |
| `K-01` | 53 | 7 | 7 | 5 | 35 | كشك عطور / Perfume Kiosk | kiosk | leased |
| `K-02` | 53 | 12 | 7 | 5 | 35 | كشك اتصالات / Telecom Kiosk | kiosk | leased |
| `M-16` | 53 | 17 | 7 | 6 | 42 | — | shop | **available (vacant 140 d)** |
| `K-03` | 21 | 9 | 2 | 3 | 6 | عربة قهوة / Coffee Cart | kiosk | leased |
| `K-04` | 37 | 18 | 2 | 3 | 6 | عربة عصائر / Juice Cart | kiosk | available |
| `ESC-M` | 28 | 11 | 4 | 8 | — | landing | — | — |

### Advertising spaces

| id | Floor | Location | Type (AR / EN) | Monthly KD | Status |
| --- | --- | --- | --- | --- | --- |
| `AD-01` | M | top of escalator (x 32, y 9) | شاشة رقمية / Digital screen | 350 | leased |
| `AD-02` | G | above main entrance | لوحة الواجهة / Entrance banner | 500 | leased |
| `AD-03` | G | trolleys (200 units) | إعلان العربات / Trolley ads | 400 | available |
| `AD-04` ×4 | G | pillars at (26,4) (34,4) (26,22) (34,22) | تغليف أعمدة / Pillar wraps | 120 each | 2 leased, 2 available |
| `AD-05` | G | checkout screens ×8 | شاشات الكاشير / Checkout screens | 300 | leased |

## Traffic model

Each fixture has a `traffic_base` (0–100). The generator multiplies it by a day factor and an hour factor:

- Day: Sat 1.0, Sun 0.85, Mon 0.8, Tue 0.8, Wed 0.9, **Thu 1.35, Fri 1.25**.
- Hour (08–23): 08 0.3, 09 0.45, 10 0.6, 11 0.75, 12 0.8, 13 0.7, 14 0.5, 15 0.5, 16 0.65, 17 0.85, 18 1.0, **19 1.2, 20 1.25, 21 1.1**, 22 0.8, 23 0.5.
- Entrance, checkouts, `CH-03/04` (dairy), `A06-*`, and `END-C*` have the highest bases (70–95). Back corners of A04/A05 are lowest (20–30). Mezzanine café and the escalator landing are high; `M-16` (vacant corner) is lowest.

Queue estimate at checkouts = `traffic(POS zone) × 0.09` people per open lane; Thursday 19:00–21:00 with 6 lanes open gives ≈ 8 people per lane → the "open a second cashier / more lanes" story.
