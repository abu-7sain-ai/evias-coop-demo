// Shapes of the generated JSON in public/data (see scripts/generate-data.mjs).

export interface Named { name_ar: string; name_en: string }

export interface Coop extends Named { id: string; code: string; members: number; est: number }
export interface Branch extends Named { id: string; coop_id: string; code: string; lanes: number; area_m2: number }
export interface Product extends Named {
  id: string; sku: string; category: string; category_ar: string; category_en: string; aisle: string;
  cost: number; price: number; shelf_life_days: number; subsidized: boolean; supplier_id: string; daily_base: number;
  cost_history: { date: string; cost: number }[]; margin_leak?: boolean;
}
export interface Supplier extends Named {
  id: string; on_time_rate: number; short_deliveries: number; near_expiry_deliveries: number; deliveries: number; bank_iban_last4: string; rating: number;
}
export interface SubsidizedPrice { product_id: string; cap_price: number; effective_from: string }
export interface Fixture extends Named {
  id: string; floor: "G" | "M"; type: string; x: number; y: number; w: number; h: number; traffic_base: number;
  category?: string; levels?: number; row?: string; prime?: boolean; status?: string | null; area_m2?: number;
  monthly_rent?: number; open_by_default?: boolean; device?: string;
}
export interface Floorplan { width: number; height: number; fixtures: Fixture[] }
export type Day = "Sat" | "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
export interface TrafficRow { fixture_id: string; day: Day; hour: number; score: number }
export interface Space extends Named {
  id: string; branch_id: string; type: string; floor: "G" | "M"; area_m2: number | null; monthly_rent: number; day_rate: number | null; status: string; vacant_days: number;
}
export interface Tenant extends Named { id: string; phone: string; civil_or_cr: string }
export interface LeaseContract {
  id: string; space_id: string; tenant_id: string; starts_on: string; ends_on: string; monthly_rent: number; deposit: number; status: string; approved_by: string; days_to_expiry: number;
}
export interface LeaseInvoice {
  id: string; contract_id: string; space_id: string; tenant_id: string; due_on: string; amount: number; paid_on: string | null; status: string; days_late: number;
}
export interface ShelfReservation {
  id: string; fixture_id: string; level: number | null; supplier_id: string; branch_id: string; monthly_rent: number; starts_on: string; ends_on: string; days_to_expiry: number; status: string;
}
export interface Lot { id: string; product_id: string; branch_id: string; qty: number; expiry: string; received_on: string; supplier_id: string; cost: number; flagged?: string; note?: string }
export interface StockLocation {
  fixture_id: string; level: number; product_id: string; facings: number; qty_on_shelf: number; qty_in_warehouse: number; min_qty: number; status: string; branch_id: string; stagnant_days?: number;
}
export interface Member extends Named {
  id: string; coop_id: string; civil_id_masked: string; phone: string; class: string; shares: number; share_value: number; ytd_purchases: number; voting_eligible: boolean; joined_on: string;
}
export interface Employee extends Named {
  id: string; coop_id: string; branch_id: string | null; username: string; role: string; role_ar: string; role_en: string; salary: number;
  hire_date: string; contract_end: string; civil_id_masked: string; active: boolean; ghost?: boolean;
}
export interface Attendance {
  employee_id: string; date: string; shift: string; status: string; punch_in?: string; punch_out?: string | null; late_minutes?: number; device_id?: string;
}
export interface Sale {
  id: string; branch_id: string; coop_id: string; date: string; time: string; cashier_id: string; member_id: string | null; phone: string | null;
  total: number; cost: number; payment: string; line_voids: number; flagged?: string;
}
export interface SaleItem { sale_id: string; product_id: string; qty: number; unit_price: number; unit_cost: number }
export interface Void { id: string; sale_id: string; branch_id: string; cashier_id: string; approved_by: string; reason: string; minutes_after_sale: number; date: string; amount: number; payment: string; flagged?: string }
export interface Refund { id: string; sale_id: string; branch_id: string; cashier_id: string; approved_by: string; reason: string; minutes_after_sale: number; date: string; amount: number; refund_method: string }
export interface Shift {
  id: string; branch_id: string; cashier_id: string; date: string; shift: "AM" | "PM"; terminal: string; opening_float: number; expected_cash: number;
  counted_cash: number; variance: number; approved_by: string; status: string; no_sale_opens: number;
}
export interface CashMovement { id: string; shift_id: string; type: string; amount: number; time: string; approved_by: string | null }
export interface DailySales { branch_id: string; coop_id: string; date: string; revenue: number; cost: number; units: number; invoices: number; voids: number; refunds: number }
export interface PurchaseOrder { id: string; supplier_id: string; branch_id: string; product_id: string; qty: number; unit_cost: number; total: number; ordered_on: string; approved_by: string; status: string }
export interface Grn { id: string; po_id: string; received_qty: number; received_on: string; days_late: number; blind_count: boolean; expiry_days_at_receipt: number; received_by: string }
export interface SupplierInvoice {
  id: string; supplier_id: string; po_id: string; grn_id: string; amount: number; due_on: string; three_way_match: string; status: string;
  approvals: { reviewer: boolean; chair: boolean; treasurer: boolean };
}
export interface SupplierDelivery { supplier_id: string; po_id: string; late: boolean; short: boolean; near_expiry: boolean }
export interface Complaint {
  id: string; branch_id: string; member_id: string | null; category: string; priority: string; subject_ar: string; subject_en: string;
  lot_id?: string; product_id?: string; opened_at: string; assigned_to: string; due_at: string; status: string; sla_breached: boolean; resolution?: string;
}
export interface Promotion {
  id: string; branch_id: string; product_id: string; lot_id?: string; type: string; type_ar: string; type_en: string; starts_on: string | null; ends_on: string | null;
  status: string; planned_units?: number; sold_units?: number; waste_avoided_kd?: number; suggested_by: string; approved_by: string | null;
}
export interface Writeoff { branch_id: string; coop_id: string; date: string; product_id: string; qty: number; value: number; reason: string }
export interface SubsidizedBreach { id: string; branch_id: string; product_id: string; cap_price: number; sold_price: number; since: string; invoices: number }
export interface Ramadan { starts_on: string; days_until: number; last_year_multipliers: Record<string, number> }
export interface AgentAlert {
  id: string; scenario: number; severity: "high" | "medium" | "low"; coop_id: string | null; branch_id: string | null;
  title_ar: string; title_en: string; question_ar: string; question_en: string; ministry?: boolean;
}
export interface Meta { dividend_config: { purchase_rebate_pct: number; share_dividend_pct: number }; demo_date: string; generated_at: string; days: number; mapped_branch: string }

export interface Data {
  coops: Coop[]; branches: Branch[]; products: Product[]; suppliers: Supplier[]; subsidized_prices: SubsidizedPrice[];
  floorplan: Floorplan; traffic: TrafficRow[]; spaces: Space[]; tenants: Tenant[]; lease_contracts: LeaseContract[]; lease_invoices: LeaseInvoice[];
  shelf_reservations: ShelfReservation[]; lots: Lot[]; stock_locations: StockLocation[]; members: Member[]; employees: Employee[]; attendance: Attendance[];
  sales: Sale[]; sale_items: SaleItem[]; voids: Void[]; refunds: Refund[]; shifts: Shift[]; cash_movements: CashMovement[]; daily_sales: DailySales[];
  purchase_orders: PurchaseOrder[]; grns: Grn[]; supplier_invoices: SupplierInvoice[]; supplier_deliveries: SupplierDelivery[]; complaints: Complaint[];
  promotions: Promotion[]; writeoffs: Writeoff[]; subsidized_breaches: SubsidizedBreach[]; ramadan: Ramadan; agent_alerts: AgentAlert[]; meta: Meta;
}

export const DATA_FILES: (keyof Data)[] = [
  "coops", "branches", "products", "suppliers", "subsidized_prices", "floorplan", "traffic", "spaces", "tenants", "lease_contracts", "lease_invoices",
  "shelf_reservations", "lots", "stock_locations", "members", "employees", "attendance", "sales", "sale_items", "voids", "refunds", "shifts",
  "cash_movements", "daily_sales", "purchase_orders", "grns", "supplier_invoices", "supplier_deliveries", "complaints", "promotions", "writeoffs",
  "subsidized_breaches", "ramadan", "agent_alerts", "meta",
];

/** Scope chosen in the topbar. coopId "ALL" = ministry network view. branchId null = all branches of the coop. */
export interface Scope { coopId: string; branchId: string | null }
