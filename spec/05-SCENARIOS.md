# 05 — Planted Stories & Demo Script

Every story below is injected by `03-generate-data.mjs` (search `// STORY`). The "Expected answer" column is what the agent must find; exact figures come from the generated JSON and may differ by a few units between regenerations only where marked ≈.

Demo date inside the data: **2026-11-01**. Mapped branch: `C1-B1` السوق المركزي / Central Market of جمعية الواحة (Al-Waha Co-op).

## A. Coop-level stories (select coop C1)

| # | Ask (AR) | Ask (EN) | Expected answer (key facts) | Tool |
| --- | --- | --- | --- | --- |
| 1 | فيه كاشير يجامل أحد؟ | Is any cashier favouring someone? | Cashier **خالد المطيري** (`EMP-001`): **9 invoices** this month for the same phone `+965 99990007` (member `C1-MEM-0007` سالم الرشيدي), every one with a line void after scanning, all cash. Pattern needs review by the branch manager + HR. | `cashier_anomalies` |
| 1b | ومن يوافق على إلغاءاته؟ | Who approves his voids? | **6 voids after cash payment** this month, 12–35 min after the sale, all approved by the same manager `EMP-007` عبدالله الخالدي. Recommend a second approver for post-cash voids. | `cashier_anomalies` |
| 2 | ليش فيه عجز بالصندوق؟ | Why is the cash drawer short? | Shortage concentrates in **Tuesday PM shifts of خالد**: 13 of 13 Tuesday shifts disputed, average variance ≈ **−8 KD**, each with **3 no-sale drawer opens** between 21:00–22:59. Recommend blind count + manager fingerprint for no-sale. | `shift_variances` |
| 3 | ليش فيه شكاوي على الزبادي؟ | Why are there yogurt complaints? | **3 complaints in 3 days** all on lot **LOT-4471** (زبادي طبيعي P003, SUP-01, 96 units, expires in 6 days). Recommend: pull the lot from shelves, block the promo (PR-002 already on hold), raise a supplier return. Approver: branch manager. | `complaints_query`, `lot_lookup` |
| 4 | فيه أصناف نبيعها بخسارة؟ | Are we selling anything at a loss? | **14 products** whose cost rose on 2026-10-18 while the shelf price stayed: list with old/new cost and margin (e.g. P054 سمك مجمد −0.227 KD/unit, P045 قهوة عربية −0.173). Recommend price review by purchaser + branch manager. | `margin_leaks` |
| 5 | وش صار بعرض العصير؟ | What happened with the juice promo? | PR-001 (عصير برتقال, LOT-4388, buy-1-get-1): planned 120, **sold 90**, **waste avoided 180.000 KD**. | `promotion_results` |
| 6 | فيه رف ميت؟ | Any dead shelf? | `A06-END-C1` level 3 (prime end-cap): **زعفران P049**, 24 units, **61 days without a sale**. Recommend swapping with a fast mover from A06 (تمر خلاص / شاي). | `shelf_performance` |
| 7 | أي رفوف الموردين تستاهل سعر أعلى؟ | Which supplier shelves deserve a higher price? | `CH-03`/`CH-04` (dairy) and `A06-END-C2` have top traffic; compare sales/m vs rent; recommend re-pricing at renewal. | `shelf_performance`, `traffic_query` |
| **8** | وش وضع الرف الثاني؟ / عقد رأس ممر A02 | What's the status of the second shelf? | `A02-END-C2` reserved by **SUP-04 شركة الوجبات الخليجية** at **180 KD/month**, ends **2026-12-16 (45 days)**. Traffic: top-5 in branch. Sales/m below branch median. Two options: **renew at a higher rent** (traffic justifies ≈ +20–30%) or **open it now to other snack suppliers** (SUP-05 مصنع الحلويات المتحدة is the natural candidate). Decision owner: leasing officer + branch manager; start now because 45 days is the notice window. | `shelf_performance`, `supplier_scorecard` |
| 9 | منو متأخر بالإيجار؟ | Who is late on rent? | **M-07 صرافة الخليج**: 2 unpaid invoices, 530 KD each, oldest **45 days late** → escalation stage "إنذار / notice", visible to ministry at 60 days. Also: M-16 vacant 140 days (lost ≈ 400 KD/month), K-04 vacant 35 days. | `rent_arrears`, `space_status` |
| 10 | طلبك المعتاد (WhatsApp) | — | Not in this build (WhatsApp sales out of scope for the demo). Agent answers it is not in the demo data. | — |
| 11 | باقي كم على رمضان ووش نحتاج؟ | How long until Ramadan and what do we need? | Ramadan starts 2027-02-08 (**99 days**). Last year: تمر خلاص ×4.1, تمر سكري ×3.8, لبن ×4.0, حليب ×2.2. Current cover in days per product; draft PO lines for the purchaser. | `seasonal_forecast` |
| 12 | متى نحتاج كاشير زيادة؟ | When do we need an extra cashier? | **Thursday & Friday 19:00–21:00**: queue ≈ 8 per open lane with 6 lanes; opening lanes 7–8 brings it to ≈ 6. Also Yousef الفضلي (`EMP-003`) is late every Sunday 20–45 min. | `staffing_suggestion`, `attendance_summary` |
| 13 | قيّم لي شركة اللحوم المجمدة | Rate Frozen Meats Co. | **SUP-12**: on-time **33%** (late 4 of 6), short deliveries 2, near-expiry deliveries 3. Recommend renegotiation or alternate supplier before next PO. | `supplier_scorecard` |
| 14 | كم عندنا مساهمين وكم عائدهم؟ | How many members and what dividend? | 60 members in demo data (coop reports 9,850), YTD purchases per member, projected rebate at the configured %, "unregistered sales" share ≈ 28%. | `member_lookup`, `sales_summary` |

## B. Ministry-level stories (role: Inspector / Ministry Admin; coop selector: "All")

| # | Ask (AR) | Ask (EN) | Expected answer | Tool |
| --- | --- | --- | --- | --- |
| 15 | منو يبيع المدعوم فوق السعر؟ | Who sells subsidized goods above cap? | Basmati rice 5 kg (cap 3.250): **C1-B2 3.450, C2-B1 3.400, C2-B3 3.500, C3-B2 3.600** with invoice counts. | `subsidized_breaches` |
| 16 | أي جمعية إتلافها شاذ؟ | Which coop has abnormal waste? | **جمعية الضاحية (C3)** waste ≈ **3×** the network average. | `ministry_compare(waste)` |
| 17 | فيه موظفين وهميين؟ | Are there ghost employees? | **C3-B2: 6 salaried employees with zero punches in 90 days**, combined salary ≈ 2,400 KD/month. Recommend HR + inspector review. | `ghost_employees` |
| 18 | كم محل شاغر عبر الجمعيات؟ | How many vacant spaces across coops? | Vacant spaces list with days vacant and lost rent (demo has full data for C1 only; say so). | `space_status` |

## C. Guardrail asks (see 04-AGENT.md)

Out-of-scope question → exact refusal line. Execution request → recommend-only reply naming the approver.

## D. Presenter run-sheet (15 minutes)

1. **Dashboard (1 min):** point at the KPI arrows; waste down, rent collected up, variance up (red).
2. **Store map (3 min):** ground floor → switch layers Supplier → Stock → Traffic; drag hour slider to Thursday 20:00; click `A02-END-C2`; press "Ask the agent about this".
3. **Agent #8 (2 min):** the second-shelf answer. Then ask #7 as a follow-up.
4. **Mezzanine (2 min):** Contracts layer; click `M-07` (arrears) and `M-16` (vacant). Ask #9.
5. **Agent #1 → #1b → #2 (3 min):** the cashier story, then "who approves", then the drawer.
6. **Agent #4 (1 min):** selling at a loss.
7. **Switch role to Inspector, coop "All" (2 min):** Ministry view, then ask #15 and #17.
8. **Close (1 min):** Settings → show the key field and the "no external transactions" footer; say the demo runs on synthetic data and the live platform follows the phased plan.

Keep the agent drawer open the whole time; pre-warm it with one question before the meeting so the first answer is fast.
