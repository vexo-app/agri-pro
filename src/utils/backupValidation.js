import { MAX_MONEY_VALUE } from "../config/constants";

const MAX_RECORDS_PER_COLLECTION = 100000;
const MAX_NESTING_DEPTH = 20;
const MAX_OBJECT_FIELDS = 500;
const MAX_GENERIC_STRING_LENGTH = 100000;
const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const shortString = (value) => typeof value === "string" && value.length <= 300;
const longString = (value) => typeof value === "string" && value.length <= 3000;
const money = (value) => Number.isFinite(value) && value >= 0 && value <= MAX_MONEY_VALUE;
const positiveMoney = (value) => money(value) && value > 0;
const enumOf = (...values) => (value) => values.includes(value);
const boolean = (value) => typeof value === "boolean";

const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
};

const fieldRules = {
  equipment: {
    fuelRate: money,
    category: enumOf("base", "attachment"),
    status: enumOf("active", "maintenance", "inactive"),
    name: shortString, type: shortString, driverId: shortString,
    customDriverName: shortString, parentEquipmentId: shortString, customParentName: shortString,
  },
  jobs: {
    acres: positiveMoney, pricePerAcre: money, fuelUsed: money, fuelPriceAtJob: money,
    amountPaid: money, date: validDate, client: shortString, workType: shortString,
    notes: longString, equipmentId: shortString, driverId: shortString,
  },
  drivers: {
    salary: money,
    status: enumOf("active", "inactive"),
    role: enumOf("driver", "staff"),
    name: shortString, phone: shortString, position: shortString,
  },
  maintenance: {
    cost: money, equipmentId: shortString, type: shortString, date: validDate, notes: longString,
  },
  equipmentFuelEntries: {
    liters: positiveMoney, pricePerLiter: positiveMoney, equipmentId: shortString, date: validDate,
  },
  payments: { amount: positiveMoney, jobId: shortString, date: validDate, notes: longString },
  supplierInvoices: {
    amount: positiveMoney, supplierName: shortString, description: longString, date: validDate, notes: longString,
  },
  supplierPayments: {
    amount: positiveMoney, supplierInvoiceId: shortString, date: validDate, notes: longString,
  },
  salaryEntries: {
    amount: money,
    type: enumOf("base", "bonus", "deduction", "advance", "advance_repay"),
    driverId: shortString, reason: shortString, date: validDate, notes: longString, paid: boolean,
  },
  attendance: {
    status: enumOf("present", "absent", "late", "half"),
    date: validDate, driverId: shortString, notes: longString,
  },
  custodyTransactions: {
    amount: positiveMoney,
    type: enumOf("deposit", "expense"),
    category: enumOf("equipment", "driver", "other"),
    equipmentId: shortString, driverId: shortString, otherLabel: shortString,
    source: shortString, date: validDate, notes: longString,
  },
  taxDeductions: {
    amount: positiveMoney,
    type: enumOf("tax", "gov_fee", "fine", "other"),
    otherLabel: shortString, date: validDate, notes: longString,
  },
  contacts: {
    name: shortString,
    type: enumOf("client", "supplier"),
    phone: shortString,
  },
};

const requiredFields = {
  jobs: ["acres"],
  maintenance: ["cost"],
  equipmentFuelEntries: ["liters", "pricePerLiter", "equipmentId", "date"],
  payments: ["amount"],
  supplierInvoices: ["amount"],
  supplierPayments: ["amount"],
  salaryEntries: ["amount"],
  custodyTransactions: ["amount"],
  taxDeductions: ["amount"],
};

const assertSafeJson = (value, path, depth = 0) => {
  if (depth > MAX_NESTING_DEPTH) throw new Error(`${path}: تداخل البيانات أعمق من المسموح`);
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path}: رقم غير صالح`);
    return;
  }
  if (typeof value === "string") {
    if (value.length > MAX_GENERIC_STRING_LENGTH) throw new Error(`${path}: نص أكبر من المسموح`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_RECORDS_PER_COLLECTION) throw new Error(`${path}: عناصر أكثر من المسموح`);
    value.forEach((item, index) => assertSafeJson(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${path}: نوع بيانات غير صالح`);
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_OBJECT_FIELDS) throw new Error(`${path}: حقول أكثر من المسموح`);
  entries.forEach(([key, item]) => {
    if (BLOCKED_KEYS.has(key)) throw new Error(`${path}: اسم حقل غير آمن`);
    assertSafeJson(item, `${path}.${key}`, depth + 1);
  });
};

const validateRecord = (collectionKey, record, index) => {
  const label = `${collectionKey}[${index}]`;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`${label}: السجل لازم يكون كائن بيانات`);
  }
  if (typeof record.id !== "string" || !record.id || record.id.length > 500
      || record.id.includes("/") || record.id === "." || record.id === "..") {
    throw new Error(`${label}: معرّف السجل غير صالح`);
  }
  for (const field of requiredFields[collectionKey] || []) {
    if (!(field in record)) throw new Error(`${label}: الحقل ${field} مطلوب`);
  }
  for (const [field, validator] of Object.entries(fieldRules[collectionKey] || {})) {
    if (field in record && !validator(record[field])) {
      throw new Error(`${label}: الحقل ${field} غير صالح`);
    }
  }
};

export const validateBackupData = (
  data,
  { allowMissingContacts = false, allowMissingSettings = false } = {}
) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("محتوى النسخة غير صالح");
  }
  assertSafeJson(data, "data");

  for (const collectionKey of Object.keys(fieldRules)) {
    const records = data[collectionKey];
    if (records === undefined && collectionKey === "contacts" && allowMissingContacts) continue;
    if (!Array.isArray(records)) throw new Error(`${collectionKey}: القائمة ناقصة أو غير صالحة`);
    if (records.length > MAX_RECORDS_PER_COLLECTION) {
      throw new Error(`${collectionKey}: عدد السجلات أكبر من المسموح`);
    }
    const ids = new Set();
    records.forEach((record, index) => {
      validateRecord(collectionKey, record, index);
      if (ids.has(record.id)) throw new Error(`${collectionKey}: معرّف مكرر (${record.id})`);
      ids.add(record.id);
    });
  }

  if (data.settings === undefined && allowMissingSettings) return true;
  if (!data.settings || typeof data.settings !== "object" || Array.isArray(data.settings)) {
    throw new Error("settings: الإعدادات ناقصة أو غير صالحة");
  }
  if ("fuelPrice" in data.settings && !money(data.settings.fuelPrice)) {
    throw new Error("settings.fuelPrice: سعر الوقود غير صالح");
  }
  return true;
};
