/**
 * TailorPro seed data — run with:  node scripts/seed.mjs
 * Idempotent: verifies the complete seed manifest before skipping.
 * --force explicitly clears the application's tables; otherwise existing data
 * without a complete manifest is preserved and reported for manual review.
 */
import { config } from "dotenv";
import { randomBytes, scryptSync } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
config({ path: [join(projectRoot, ".env.local"), join(projectRoot, ".env")], quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Configure .env.local or .env before seeding.");
}

const SEED_KEY = "tailorpro_demo_seed";
const SEED_VERSION = 2;
const EXPECTED_COUNTS = {
  appointments: 4,
  customers: 10,
  expenses: 6,
  fabrics: 6,
  garment_types: 6,
  measurement_profiles: 12,
  measurement_sets: 17,
  notifications: 4,
  order_items: 16,
  order_status_history: 45,
  orders: 13,
  payments: 10,
  settings: 1,
  tasks: 32,
  users: 5,
  workers: 5,
};

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;

async function seed(c) {
  const force = process.argv.includes("--force");
  const insertedIds = {};

  const iso = (offsetDays = 0) =>
    new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
  const now = (offsetHours = 0) =>
    new Date(Date.now() + offsetHours * 3_600_000).toISOString();

  async function ins(table, row) {
    const cols = Object.keys(row);
    const res = await c.query(
      `INSERT INTO ${quoteIdentifier(table)} (${cols.map(quoteIdentifier).join(",")}) VALUES (${cols
        .map((_, i) => `$${i + 1}`)
        .join(",")}) RETURNING *`,
      cols.map((k) => row[k]),
    );
    const r = res.rows[0];
    const id = r.id ?? r.key;
    (insertedIds[table] ??= []).push(id);
    return id;
  }

  const marker = await c.query("SELECT value FROM settings WHERE key = $1", [SEED_KEY]);
  if (!force && marker.rows.length > 0) {
    const manifest = marker.rows[0].value;
    if (manifest?.version !== SEED_VERSION || !manifest.rows) {
      throw new Error("The demo seed manifest is unsupported or incomplete. Existing data was preserved; use an empty development database or review the existing seed before resetting it.");
    }
    for (const [table, expected] of Object.entries(EXPECTED_COUNTS)) {
      const ids = manifest.rows[table];
      if (!Array.isArray(ids) || ids.length !== expected || new Set(ids).size !== expected) {
        throw new Error(`The demo seed manifest is incomplete for ${table}. Existing data was preserved; restore the missing demo records or choose an empty development database.`);
      }
      const column = table === "settings" ? "key" : "id";
      const cast = table === "settings" ? "text[]" : "uuid[]";
      const result = await c.query(
        `SELECT count(*)::int AS n FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier(column)} = ANY($1::${cast})`,
        [ids],
      );
      if (result.rows[0].n !== expected) {
        throw new Error(`The demo seed is incomplete: ${table} contains ${result.rows[0].n}/${expected} expected demo records. Existing data was preserved; restore the missing records or choose an empty development database.`);
      }
    }
    console.log("Complete demo seed already exists; no data changed.");
    return;
  }
  const occupied = [];
  for (const table of Object.keys(EXPECTED_COUNTS)) {
    const result = await c.query(`SELECT count(*)::int AS n FROM ${quoteIdentifier(table)}`);
    if (result.rows[0].n > 0) occupied.push(`${table}=${result.rows[0].n}`);
  }
  if (!force && occupied.length > 0) {
    throw new Error(`Database contains existing or partial seed data without a complete demo manifest (${occupied.join(", ")}). No data was changed. Back up this database and use an empty development database; --force is available only when you explicitly intend to clear all application data.`);
  }
  if (force) {
    await c.query(`TRUNCATE ${Object.keys(EXPECTED_COUNTS).map(quoteIdentifier).join(",")} RESTART IDENTITY CASCADE`);
  }

  /* ---------------------------------------------------------------- schemas */

  const F = (key, bn, en, order, opts = {}) => ({
    key,
    label_bn: bn,
    label_en: en,
    type: opts.type ?? "measurement",
    required: opts.required ?? true,
    min: opts.min ?? 20,
    max: opts.max ?? 200,
    help_bn: opts.help ?? "",
    diagram_hint: opts.hint ?? key,
    order,
  });

  const measurementSchema = (groups, rules = []) => ({
    version: 1,
    unit: "cm",
    groups,
    validation_rules: rules,
  });

  const shirtSchema = measurementSchema(
    [
      {
        key: "upper_body",
        label_bn: "উপরের অংশ",
        label_en: "Upper body",
        fields: [
          F("length", "লম্বা", "Length", 1, { min: 55, max: 110, help: "কাঁধের সর্বোচ্চ বিন্দু থেকে কাঙ্ক্ষিত দৈর্ঘ্য পর্যন্ত", hint: "length" }),
          F("chest", "বুক", "Chest", 2, { min: 60, max: 160, help: "বগলের নিচ দিয়ে বুকের সবচেয়ে চওড়া অংশ ঘিরে", hint: "chest" }),
          F("waist", "পেট/কোমর", "Waist", 3, { min: 55, max: 160, help: "নাভির সামান্য ওপরে ঘিরে", hint: "waist" }),
          F("hip", "হিপ", "Hip", 4, { required: false, min: 60, max: 170, help: "ঐচ্ছিক", hint: "hip" }),
          F("shoulder", "কাঁধ", "Shoulder", 5, { min: 30, max: 60, help: "এক কাঁধের প্রান্ত থেকে অন্য প্রান্ত, পিঠের ওপর দিয়ে", hint: "shoulder" }),
          F("sleeve", "হাতা", "Sleeve", 6, { min: 40, max: 75, help: "কাঁধের প্রান্ত থেকে কব্জি পর্যন্ত", hint: "sleeve" }),
          F("cuff", "হাতার মুহুরি", "Cuff", 7, { min: 18, max: 40, help: "কব্জি ঘিরে, আরামের জন্য সামান্য অতিরিক্ত", hint: "cuff" }),
          F("bicep", "বাইসেপ/বাহু", "Bicep", 8, { required: false, min: 22, max: 60, hint: "bicep" }),
          F("neck", "গলা", "Neck", 9, { min: 25, max: 55, help: "গলার গোড়া ঘিরে, এক আঙুল জায়গা রেখে", hint: "neck" }),
          F("collar_height", "কলার উচ্চতা", "Collar height", 10, { required: false, min: 2, max: 12, type: "number", hint: "collar" }),
        ],
      },
    ],
    [
      { type: "ratio", fields: ["chest", "waist"], min: 0.7, max: 1.4, severity: "warning", message_bn: "বুক ও কোমরের অনুপাত অস্বাভাবিক, আবার মেপে দেখুন" },
      { type: "compare", fields: ["shoulder"], max_of: ["chest"], divisor: 2, slack: 5, severity: "warning", message_bn: "কাঁধের মাপ সন্দেহজনক — আবার যাচাই করুন" },
    ],
  );

  const panjabiSchema = measurementSchema(
    [
      {
        key: "upper_body",
        label_bn: "উপরের অংশ",
        label_en: "Upper body",
        fields: [
          F("length", "লম্বা", "Length", 1, { min: 70, max: 140, help: "কাঁধের সর্বোচ্চ বিন্দু থেকে কাঙ্ক্ষিত দৈর্ঘ্য", hint: "length" }),
          F("chest", "বুক", "Chest", 2, { min: 60, max: 160, hint: "chest" }),
          F("waist", "পেট", "Waist", 3, { min: 55, max: 160, hint: "waist" }),
          F("hem", "ঘের/নিচের ঘের", "Bottom hem", 4, { min: 70, max: 200, help: "নিচের গোড়ার চওড়া", hint: "hem" }),
          F("shoulder", "কাঁধ", "Shoulder", 5, { min: 30, max: 60, hint: "shoulder" }),
          F("sleeve", "হাতা", "Sleeve", 6, { min: 40, max: 75, hint: "sleeve" }),
          F("cuff", "হাতার মুহুরি", "Cuff", 7, { min: 18, max: 40, hint: "cuff" }),
          F("neck", "গলা", "Neck", 8, { min: 25, max: 55, hint: "neck" }),
          F("front_neck_depth", "গলার সামনের গভীরতা", "Front neck depth", 9, { required: false, min: 3, max: 30, hint: "neck" }),
          F("back_neck_depth", "গলার পেছনের গভীরতা", "Back neck depth", 10, { required: false, min: 2, max: 25, hint: "neck" }),
        ],
      },
    ],
    [{ type: "ratio", fields: ["chest", "waist"], min: 0.7, max: 1.4, severity: "warning", message_bn: "বুক ও পেটের অনুপাত অস্বাভাবিক, আবার মেপে দেখুন" }],
  );

  const pantSchema = measurementSchema([
    {
      key: "lower_body",
      label_bn: "নিচের অংশ",
      label_en: "Lower body",
      fields: [
        F("length", "লম্বা", "Length", 1, { min: 70, max: 130, help: "কোমর থেকে মুহুরি পর্যন্ত", hint: "length" }),
        F("waist", "কোমর", "Waist", 2, { min: 55, max: 160, hint: "waist" }),
        F("hip", "হিপ/সীট", "Hip", 3, { min: 65, max: 170, hint: "hip" }),
        F("thigh", "থাই/উরু", "Thigh", 4, { min: 35, max: 90, hint: "thigh" }),
        F("knee", "হাঁটু", "Knee", 5, { required: false, min: 25, max: 70, hint: "knee" }),
        F("bottom", "মুহুরি (বটম)", "Bottom", 6, { min: 25, max: 70, hint: "bottom" }),
        F("crotch", "ক্রচ/রাইজ", "Crotch", 7, { min: 20, max: 45, hint: "crotch" }),
      ],
    },
  ]);

  const pajamaSchema = measurementSchema([
    {
      key: "lower_body",
      label_bn: "নিচের অংশ",
      label_en: "Lower body",
      fields: [
        F("length", "লম্বা", "Length", 1, { min: 70, max: 130, hint: "length" }),
        F("waist", "কোমর", "Waist", 2, { min: 55, max: 160, hint: "waist" }),
        F("hip", "হিপ", "Hip", 3, { min: 65, max: 170, hint: "hip" }),
        F("thigh", "উরু", "Thigh", 4, { min: 35, max: 90, hint: "thigh" }),
        F("bottom", "মুহুরি", "Bottom", 5, { min: 25, max: 70, hint: "bottom" }),
      ],
    },
  ]);

  const kameezSchema = measurementSchema(
    [
      {
        key: "upper_body",
        label_bn: "উপরের অংশ",
        label_en: "Upper body",
        fields: [
          F("length", "লম্বা", "Length", 1, { min: 70, max: 150, hint: "length" }),
          F("bust", "বুক/বাস্ট", "Bust", 2, { min: 60, max: 160, hint: "chest" }),
          F("underbust", "আন্ডারবাস্ট", "Underbust", 3, { min: 55, max: 150, hint: "chest" }),
          F("waist", "কোমর", "Waist", 4, { min: 50, max: 150, hint: "waist" }),
          F("hip", "হিপ", "Hip", 5, { min: 60, max: 170, hint: "hip" }),
          F("shoulder", "কাঁধ", "Shoulder", 6, { min: 30, max: 55, hint: "shoulder" }),
          F("sleeve", "হাতা", "Sleeve", 7, { min: 35, max: 70, hint: "sleeve" }),
          F("sleeve_round", "হাতার ঘের", "Sleeve round", 8, { min: 18, max: 45, hint: "cuff" }),
          F("front_neck_depth", "সামনের গলা", "Front neck", 9, { required: false, min: 3, max: 35, hint: "neck" }),
          F("back_neck_depth", "পেছনের গলা", "Back neck", 10, { required: false, min: 2, max: 30, hint: "neck" }),
          F("armhole", "আর্মহোল", "Armhole", 11, { min: 30, max: 60, hint: "armhole" }),
          F("slit_height", "স্লিট উচ্চতা", "Slit height", 12, { required: false, min: 5, max: 60, hint: "hem" }),
        ],
      },
    ],
    [{ type: "ratio", fields: ["bust", "waist"], min: 0.7, max: 1.5, severity: "warning", message_bn: "বাস্ট ও কোমরের অনুপাত অস্বাভাবিক, আবার মেপে দেখুন" }],
  );

  const blouseSchema = measurementSchema([
    {
      key: "upper_body",
      label_bn: "উপরের অংশ",
      label_en: "Upper body",
      fields: [
        F("length", "লম্বা", "Length", 1, { min: 30, max: 70, hint: "length" }),
        F("bust", "বুক", "Bust", 2, { min: 55, max: 150, hint: "chest" }),
        F("underbust", "আন্ডারবাস্ট", "Underbust", 3, { min: 50, max: 145, hint: "chest" }),
        F("waist", "কোমর", "Waist", 4, { min: 45, max: 145, hint: "waist" }),
        F("shoulder", "কাঁধ", "Shoulder", 5, { min: 28, max: 50, hint: "shoulder" }),
        F("sleeve", "হাতা", "Sleeve", 6, { min: 20, max: 60, hint: "sleeve" }),
        F("sleeve_round", "হাতার ঘের", "Sleeve round", 7, { min: 18, max: 45, hint: "cuff" }),
        F("front_neck_depth", "সামনের গলা", "Front neck", 8, { min: 3, max: 35, hint: "neck" }),
        F("back_neck_depth", "পেছনের গলা", "Back neck", 9, { min: 2, max: 40, hint: "neck" }),
        F("dart_point", "ডার্ট পয়েন্ট", "Dart point", 10, { required: false, min: 5, max: 35, hint: "chest" }),
      ],
    },
  ]);

  const styleOptions = (groups) => ({ options: groups });

  const SHIRT_STYLE = styleOptions([
    { key: "collar", label_bn: "কলার", type: "select", choices: [{ value: "regular", label_bn: "রেগুলার" }, { value: "mandarin", label_bn: "ব্যান্ড/ম্যান্ডারিন" }, { value: "button_down", label_bn: "বাটন-ডাউন" }, { value: "cutaway", label_bn: "কাটওয়ে" }] },
    { key: "cuff_type", label_bn: "কাফ", type: "select", choices: [{ value: "round", label_bn: "গোল" }, { value: "square", label_bn: "চৌকো" }, { value: "one_button", label_bn: "এক বোতাম" }, { value: "double", label_bn: "ডাবল বাটন" }] },
    { key: "pocket", label_bn: "পকেট", type: "select", choices: [{ value: "none", label_bn: "নেই" }, { value: "one", label_bn: "একটি" }, { value: "two", label_bn: "দুটি" }, { value: "pocket_square", label_bn: "স্কয়ার পকেট" }] },
    { key: "placket", label_bn: "প্লাকেট", type: "select", choices: [{ value: "normal", label_bn: "সাধারণ" }, { value: "hidden", label_bn: "লুকানো" }, { value: "piper", label_bn: "পাইপার" }] },
    { key: "fit", label_bn: "ফিট", type: "select", choices: [{ value: "slim", label_bn: "স্লিম" }, { value: "regular", label_bn: "রেগুলার" }, { value: "loose", label_bn: "ঢিলা" }] },
    { key: "button", label_bn: "বোতাম", type: "select", choices: [{ value: "normal", label_bn: "সাধারণ" }, { value: "pearl", label_bn: "মোতিয়া" }, { value: "horn", label_bn: "শিং" }] },
  ]);

  const PANJABI_STYLE = styleOptions([
    { key: "collar", label_bn: "কলার/ব্যান্ড", type: "select", choices: [{ value: "ban", label_bn: "ব্যান্ড" }, { value: "classic", label_bn: "ক্লাসিক" }, { value: " chinese ", label_bn: "চায়নিজ" }] },
    { key: "placket", label_bn: "প্লাকেট", type: "select", choices: [{ value: "full", label_bn: "ফুল" }, { value: "half", label_bn: "আধা" }, { value: "hidden", label_bn: "লুকানো" }] },
    { key: "pocket", label_bn: "পকেট", type: "select", choices: [{ value: "none", label_bn: "নেই" }, { value: "one", label_bn: "একটি" }, { value: "two", label_bn: "দুটি" }] },
    { key: "side_cut", label_bn: "সাইড কাট", type: "select", choices: [{ value: "normal", label_bn: "সাধারণ" }, { value: "high", label_bn: "উঁচু" }] },
    { key: "embroidery", label_bn: "কাজ/এমব্রয়ডারি", type: "select", choices: [{ value: "none", label_bn: "নেই" }, { value: "light", label_bn: "হালকা" }, { value: "heavy", label_bn: "ভারী" }] },
    { key: "fit", label_bn: "ফিট", type: "select", choices: [{ value: "regular", label_bn: "রেগুলার" }, { value: "slim", label_bn: "স্লিম" }, { value: "loose", label_bn: "ঢিলা" }] },
  ]);

  const PANT_STYLE = styleOptions([
    { key: "fit", label_bn: "ফিট", type: "select", choices: [{ value: "regular", label_bn: "রেগুলার" }, { value: "slim", label_bn: "স্লিম" }, { value: "straight", label_bn: "সোজা" }] },
    { key: "pleat", label_bn: "প্লিট", type: "select", choices: [{ value: "none", label_bn: "নেই" }, { value: "single", label_bn: "এক" }, { value: "double", label_bn: "দুই" }] },
    { key: "pocket", label_bn: "পকেট", type: "select", choices: [{ value: "side", label_bn: "সাইড" }, { value: "side_back", label_bn: "সাইড + পেছনে" }] },
    { key: "bottom_fold", label_bn: "বটম ফোল্ড", type: "select", choices: [{ value: "plain", label_bn: "সাধারণ" }, { value: "cuff", label_bn: "কাফ" }] },
    { key: "waist_type", label_bn: "কোমর", type: "select", choices: [{ value: "belt", label_bn: "বেল্ট" }, { value: "elastic", label_bn: "এলাস্টিক" }] },
  ]);

  const KAMEEZ_STYLE = styleOptions([
    { key: "neck_design", label_bn: "গলা ডিজাইন", type: "select", choices: [{ value: "round", label_bn: "গোল" }, { value: "v", label_bn: "ভি" }, { value: "sweetheart", label_bn: "সোয়িটহার্ট" }, { value: "boat", label_bn: "বোট" }] },
    { key: "sleeve_design", label_bn: "হাতা ডিজাইন", type: "select", choices: [{ value: "straight", label_bn: "সোজা" }, { value: "bell", label_bn: "বেল" }, { value: "elbow", label_bn: "এলবো" }] },
    { key: "slit", label_bn: "স্লিট", type: "select", choices: [{ value: "both", label_bn: "দুই পাশে" }, { value: "one", label_bn: "এক পাশে" }, { value: "none", label_bn: "নেই" }] },
    { key: "lining", label_bn: "লাইনিং", type: "select", choices: [{ value: "none", label_bn: "নেই" }, { value: "full", label_bn: "ফুল" }, { value: "top", label_bn: "শুধু ওপরে" }] },
  ]);

  /* --------------------------------------------------------------- garments */

  const garmentRows = [
    { code: "shirt", nameBn: "শার্ট", nameEn: "Shirt", category: "gents", ms: shirtSchema, ss: SHIRT_STYLE, price: 950, days: 4, fabric: 2.25 },
    { code: "panjabi", nameBn: "পাঞ্জাবি", nameEn: "Panjabi", category: "gents", ms: panjabiSchema, ss: PANJABI_STYLE, price: 1850, days: 7, fabric: 2.5 },
    { code: "pant", nameBn: "প্যান্ট/ট্রাউজার", nameEn: "Pant", category: "gents", ms: pantSchema, ss: PANT_STYLE, price: 1250, days: 6, fabric: 1.75 },
    { code: "pajama", nameBn: "পায়জামা", nameEn: "Pajama", category: "gents", ms: pajamaSchema, ss: PANT_STYLE, price: 900, days: 5, fabric: 1.5 },
    { code: "kameez", nameBn: "কামিজ/সালোয়ার", nameEn: "Kameez", category: "ladies", ms: kameezSchema, ss: KAMEEZ_STYLE, price: 2200, days: 8, fabric: 3.25 },
    { code: "blouse", nameBn: "ব্লাউজ", nameEn: "Blouse", category: "ladies", ms: blouseSchema, ss: KAMEEZ_STYLE, price: 850, days: 5, fabric: 1.25 },
  ];

  const garments = {};
  for (let i = 0; i < garmentRows.length; i++) {
    const g = garmentRows[i];
    garments[g.code] = await ins("garment_types", {
      code: g.code,
      name_bn: g.nameBn,
      name_en: g.nameEn,
      category: g.category,
      measurement_schema: g.ms,
      style_schema: g.ss,
      base_price: g.price,
      default_delivery_days: g.days,
      default_fabric_estimate: g.fabric,
      is_active: true,
      schema_version: 1,
      sort_order: i,
    });
  }

  /* ------------------------------------------------------------------ users */

  const userRows = [
    { name: "মোঃ সাইফুল ইসলাম", phone: "+8801711000001", email: "admin@rahimantailors.com", role: "owner", password: "admin123" },
    { name: "নাজমুল হক (ম্যানেজার)", phone: "+8801711000002", email: "manager@rahimantailors.com", role: "manager", password: "manager123" },
    { name: "রুবেল হোসেন (রিসেপশন)", phone: "+8801711000003", email: "reception@rahimantailors.com", role: "reception", password: "reception123" },
    { name: "হাবিব মিয়া (মাস্টার)", phone: "+8801711000004", email: "master@rahimantailors.com", role: "master", password: "master123" },
    { name: "সোহেল রানা", phone: "+8801712000002", email: "worker@rahimantailors.com", role: "worker", password: "worker123" },
  ];
  const users = {};
  for (const u of userRows) {
    users[u.role] = await ins("users", {
      name: u.name,
      phone: u.phone,
      email: u.email,
      password_hash: hashPassword(u.password),
      role: u.role,
      is_active: true,
    });
  }

  await ins("settings", {
    key: "shop",
    value: {
      name_bn: "রহমান টেইলার্স",
      name_en: "Rahman Tailors",
      tagline: "মাপ হোক নিখুঁত, ফিট হোক চিরন্তন",
      established: 1994,
      address: "১২/বি, ধানমন্ডি, ঢাকা-১২০৯",
      phone: "01711-000001",
      hours: "সকাল ১০টা – রাত ৯টা (শুক্রবার ছুটি)",
      invoice_footer: "বিক্রিত পণ্য ফেরত নেওয়া হয় না; অল্টারেশন ৭ দিনের মধ্যে ফ্রি।",
      currency: "BDT",
    },
    updated_at: new Date().toISOString(),
  });

  /* --------------------------------------------------------------- workers */

  const workerRows = [
    { name: "আমিনুল ইসলাম", role: "cutting", skill: ["শার্ট", "পাঞ্জাবি"] },
    { name: "সোহেল রানা", role: "stitching", skill: ["পাঞ্জাবি", "কুর্তা"] },
    { name: "লিয়াকত হোসেন", role: "stitching", skill: ["শার্ট", "প্যান্ট"] },
    { name: "রফিকুল ইসলাম", role: "finishing", skill: ["ইস্ত্রি", "বোতাম"] },
    { name: "জসিম উদ্দিন", role: "finishing", skill: ["ফিনিশিং", "প্যাকেজিং"] },
  ];
  const workers = {};
  for (const w of workerRows) {
    workers[w.name] = await ins("workers", {
      name: w.name,
      user_id: w.name === "সোহেল রানা" ? users.worker : null,
      phone: `+880171200000${workerRows.indexOf(w) + 1}`,
      role: w.role,
      skill_tags: w.skill,
      pay_type: "piece_rate",
      is_active: true,
      joined_on: iso(-900 + workerRows.indexOf(w) * 40),
    });
  }

  /* -------------------------------------------------------------- customers */

  const customerRows = [
    { name: "রহিমউদ্দিন আহমেদ", phone: "01712345678", address: "৪৫, মিরপুর ১০, ঢাকা", tags: ["VIP", "ঈদ রেগুলার"], note: "প্রতি ঈদে ৩টি পাঞ্জাবি বানান", gender: "male" },
    { name: "সাবরিনা আক্তার", phone: "01819876543", address: "৭/৩, বনানী, ঢাকা", tags: ["VIP"], note: "কামিজের জন্য সবসময় নিজের কাপড় আনেন", gender: "female" },
    { name: "তানভীর হাসান", phone: "01911223344", address: "২২, উত্তরা সেক্টর ৭, ঢাকা", tags: ["কর্পোরেট"], gender: "male" },
    { name: "মোঃ জাহাঙ্গীর আলম", phone: "01611556677", address: "৯১, মোহাম্মদপুর, ঢাকা", tags: [], gender: "male" },
    { name: "নুসরাত জাহান", phone: "01521447788", address: "৩, গুলশান লিংক রোড, ঢাকা", tags: ["বিয়ে"], gender: "female" },
    { name: "ফরহানা ইসলাম", phone: "01312998877", address: "১৮, বাড়ি ৪, রূপনগর, চট্টগ্রাম", tags: [], gender: "female" },
    { name: "আব্দুল কাদের", phone: "01713445566", address: "৬০, পুরানা ঢাকা", tags: ["পুরনো কাস্টমার"], gender: "male" },
    { name: "সুমাইয়া হক", phone: "01844556677", address: "১১, ধানমন্ডি ৩২, ঢাকা", tags: [], gender: "female" },
    { name: "মিজানুর রহমান", phone: "01977665544", address: "৫, বরিশাল সিটি", tags: [], gender: "male" },
    { name: "রেহনুমা বেগম", phone: "01677889900", address: "৮৮, সাভার, ঢাকা", tags: ["ঈদ রেগুলার"], gender: "female" },
  ];

  const customers = {};
  const profiles = {};
  for (const cu of customerRows) {
    const id = await ins("customers", {
      name: cu.name,
      phone: `+88${cu.phone}`,
      address: cu.address,
      notes: cu.note ?? null,
      tags: cu.tags,
      gender: cu.gender,
      sms_opt_in: true,
      portal_enabled: true,
    });
    customers[cu.phone] = id;
    profiles[cu.phone] = {};
    profiles[cu.phone]["নিজে"] = await ins("measurement_profiles", {
      customer_id: id,
      display_name: "নিজে",
      relation: "self",
      gender: cu.gender,
      is_default: true,
      body_notes: cu.note ?? null,
    });
  }
  // family profiles (PRD 4.6 — one account, several measurement profiles)
  profiles["01712345678"]["ছেলে সাকিব"] = await ins("measurement_profiles", {
    customer_id: customers["01712345678"],
    display_name: "ছেলে সাকিব",
    relation: "son",
    gender: "male",
    birth_date: iso(-365 * 9),
    is_default: false,
    body_notes: "বয়স বাড়ছে — ৩ মাস পর মাপ আপডেট করার পরামর্শ",
  });
  profiles["01819876543"]["মেয়ে তানিয়া"] = await ins("measurement_profiles", {
    customer_id: customers["01819876543"],
    display_name: "মেয়ে তানিয়া",
    relation: "daughter",
    gender: "female",
    birth_date: iso(-365 * 14),
    is_default: false,
  });

  /* ------------------------------------------------------- measurement sets */

  const V = {
    shirt42: { length: 74, chest: 106, waist: 98, hip: 104, shoulder: 46, sleeve: 62, cuff: 24, bicep: 36, neck: 40, collar_height: 3.5 },
    panjabi42: { length: 104, chest: 108, waist: 100, hem: 124, shoulder: 46, sleeve: 60, cuff: 23, neck: 41, front_neck_depth: 9, back_neck_depth: 4 },
    pant42: { length: 102, waist: 96, hip: 106, thigh: 64, knee: 52, bottom: 42, crotch: 30 },
    pajama42: { length: 98, waist: 94, hip: 104, thigh: 62, bottom: 40 },
    kameez38: { length: 112, bust: 94, underbust: 86, waist: 78, hip: 98, shoulder: 38, sleeve: 56, sleeve_round: 28, front_neck_depth: 14, back_neck_depth: 10, armhole: 44, slit_height: 34 },
    blouse36: { length: 40, bust: 86, underbust: 78, waist: 70, shoulder: 35, sleeve: 44, sleeve_round: 27, front_neck_depth: 16, back_neck_depth: 20, dart_point: 18 },
    shirt38: { length: 71, chest: 97, waist: 90, hip: 99, shoulder: 43, sleeve: 60, cuff: 23, bicep: 34, neck: 39, collar_height: 3.5 },
    kid: { length: 52, chest: 72, waist: 66, shoulder: 34, sleeve: 44, cuff: 19, neck: 33 },
  };

  async function addSet(profileId, garmentCode, values, opts = {}) {
    const verified = opts.verified ?? true;
    return ins("measurement_sets", {
      profile_id: profileId,
      garment_type_id: garments[garmentCode],
      version: opts.version ?? 1,
      values,
      styles: opts.styles ?? {},
      unit_entered: opts.unit ?? "inch",
      source: opts.source ?? "in_store",
      verified,
      verified_by: verified ? users.master : null,
      verified_at: verified ? now(-72) : null,
      measured_by: users.master,
      measured_at: opts.at ?? now(-240),
      based_on_set_id: opts.basedOn ?? null,
      change_note: opts.changeNote ?? null,
      notes: opts.notes ?? null,
      schema_version: 1,
      is_current: opts.current ?? true,
      created_at: opts.at ?? now(-240),
    });
  }

  const p1 = profiles["01712345678"]["নিজে"];
  const s_shirt_v1 = await addSet(p1, "shirt", V.shirt42, { at: now(-2400), notes: "ডান কাঁধ সামান্য নিচু" });
  const s_shirt_v2 = await addSet(p1, "shirt", { ...V.shirt42, waist: 101, chest: 108 }, {
    version: 2, at: now(-96), basedOn: s_shirt_v1, changeNote: "ওজন বাড়েছে — পেট ১ ইঞ্চি ঢিলা", current: true,
  });
  // v2 became current when created
  await c.query("UPDATE measurement_sets SET is_current=false WHERE id=$1", [s_shirt_v1]);
  const s_shirt = s_shirt_v2;
  const s_panjabi = await addSet(p1, "panjabi", V.panjabi42, { at: now(-2400) });
  const s_pant = await addSet(p1, "pant", V.pant42, { at: now(-2400) });

  const p2 = profiles["01819876543"]["নিজে"];
  const s_kameez = await addSet(p2, "kameez", V.kameez38, { at: now(-700), notes: "হাতা সামান্য ছোট রাখতে চান" });
  const s_blouse = await addSet(p2, "blouse", V.blouse36, { at: now(-700), source: "from_garment" });

  const p3 = profiles["01911223344"]["নিজে"];
  const s_shirt3 = await addSet(p3, "shirt", V.shirt38, { at: now(-400) });
  const s_pant3 = await addSet(p3, "pant", { ...V.pant42, waist: 92, thigh: 60 }, { at: now(-400) });
  const s_pajama3 = await addSet(p3, "pajama", { ...V.pajama42, waist: 92 }, { at: now(-400) });

  const p4 = profiles["01611556677"]["নিজে"];
  const s_shirt4 = await addSet(p4, "shirt", { ...V.shirt42, chest: 112, length: 76 }, { at: now(-120), source: "reused", verified: false });

  const p5 = profiles["01521447788"]["নিজে"];
  const s_kameez5 = await addSet(p5, "kameez", { ...V.kameez38, waist: 74, bust: 90 }, { at: now(-300), notes: "বিয়ের অর্ডার — কাজ ভারী রাখতে হবে" });

  const p6 = profiles["01312998877"]["নিজে"];
  const s_kameez6 = await addSet(p6, "kameez", { ...V.kameez38, bust: 98, hip: 102 }, { at: now(-500) });

  const p7 = profiles["01713445566"]["নিজে"];
  const s_shirt7 = await addSet(p7, "shirt", { ...V.shirt42, length: 72 }, { at: now(-1500), source: "reused", verified: false });

  const p8 = profiles["01844556677"]["নিজে"];
  const s_blouse8 = await addSet(p8, "blouse", { ...V.blouse36, bust: 82, waist: 66 }, { at: now(-200) });

  const pKid = profiles["01712345678"]["ছেলে সাকিব"];
  const s_kid = await addSet(pKid, "shirt", V.kid, { at: now(-200), verified: false, source: "in_store" });

  const p9 = profiles["01977665544"]["নিজে"];
  const s_shirt9 = await addSet(p9, "shirt", { ...V.shirt42, chest: 118, waist: 112 }, { at: now(-60) });

  const p10 = profiles["01677889900"]["নিজে"];
  const s_kameez10 = await addSet(p10, "kameez", { ...V.kameez38, bust: 92, waist: 82 }, { at: now(-430) });

  /* -------------------------------------------------------- fabrics & stock */

  const fabricRows = [
    { code: "FAB-IND-01", name: "ইন্ডিগো সুতি (সোলিড)", type: "cotton", color: "ইন্ডিগো", cost: 420, sell: 620, stock: 84, reorder: 20, supplier: "নারায়ণগঞ্জ টেক্সটাইল" },
    { code: "FAB-CRM-02", name: "ক্রিম খাদি", type: "khaddar", color: "ক্রিম", cost: 380, sell: 560, stock: 12, reorder: 20, supplier: "রাজশাহী খাদি" },
    { code: "FAB-SLK-03", name: "সিল্ক (সোনালি কাজ)", type: "silk", color: "অফ-হোয়াইট", cost: 950, sell: 1450, stock: 36, reorder: 10, supplier: "জাকির সিল্ক" },
    { code: "FAB-LNN-04", name: "লিনেন (প্যান্ট)", type: "linen", color: "স্লেট ধূসর", cost: 540, sell: 780, stock: 48, reorder: 15, supplier: "নারায়ণগঞ্জ টেক্সটাইল" },
    { code: "FAB-PPL-05", name: "পলি-কটন (শার্ট)", type: "cotton", color: "সাদা", cost: 300, sell: 470, stock: 6, reorder: 18, supplier: "ইসলাপুর ক্লথ" },
    { code: "FAB-GLT-06", name: "গিলাফ কাপড় (কামিজ)", type: "georgette", color: "নেভি", cost: 720, sell: 1100, stock: 25, reorder: 8, supplier: "জাকির সিল্ক" },
  ];
  const fabrics = {};
  for (const f of fabricRows) {
    fabrics[f.code] = await ins("fabrics", {
      code: f.code,
      name: f.name,
      type: f.type,
      color: f.color,
      unit: "yard",
      cost_price: f.cost,
      sell_price: f.sell,
      stock_qty: f.stock,
      reorder_level: f.reorder,
      supplier: f.supplier,
    });
  }

  /* ---------------------------------------------------------------- orders */

  const styles = {
    shirt: { collar: "mandarin", cuff_type: "round", pocket: "two", placket: "normal", fit: "regular", button: "horn" },
    panjabi: { collar: "ban", placket: "half", pocket: "one", side_cut: "normal", embroidery: "light", fit: "regular" },
    pant: { fit: "straight", pleat: "single", pocket: "side", bottom_fold: "plain", waist_type: "belt" },
    pajama: { fit: "regular", pleat: "none", pocket: "side", bottom_fold: "plain", waist_type: "elastic" },
    kameez: { neck_design: "sweetheart", sleeve_design: "straight", slit: "both", lining: "full" },
    blouse: { neck_design: "round", sleeve_design: "elbow", slit: "none", lining: "none" },
  };

  let seq = 41;
  const orderNo = (d = new Date()) => {
    seq += 1;
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `TP-${yy}${mm}-${String(seq).padStart(4, "0")}`;
  };

  async function addOrder(cfg) {
    const total = cfg.items.reduce((s, it) => s + it.unitPrice * it.qty, 0) - (cfg.discount ?? 0);
    const paid = cfg.paid ?? 0;
    if (total < 0 || paid < 0 || paid > total) {
      throw new Error(`Invalid demo order totals: total=${total}, paid=${paid}`);
    }
    const orderId = await ins("orders", {
      order_no: orderNo(),
      customer_id: customers[cfg.phone],
      type: cfg.type ?? "new",
      status: cfg.status,
      priority: cfg.priority ?? "normal",
      order_date: cfg.orderDate ?? iso(-4),
      trial_date: cfg.trialDate ?? null,
      delivery_date: cfg.deliveryDate,
      subtotal: String(cfg.items.reduce((s, it) => s + it.unitPrice * it.qty, 0)),
      discount: String(cfg.discount ?? 0),
      total: String(total),
      paid_amount: String(paid),
      due_amount: String(total - paid),
      source: cfg.source ?? "walk_in",
      notes: cfg.notes ?? null,
      created_at: cfg.createdAt ?? now(-96),
    });

    for (const it of cfg.items) {
      const itemId = await ins("order_items", {
        order_id: orderId,
        garment_type_id: garments[it.garment],
        profile_id: it.profileId,
        measurement_set_id: it.setId,
        style_overrides: styles[it.garment] ?? {},
        fabric_source: it.fabricSource ?? "shop",
        fabric_qty: String(it.fabricQty ?? 2.5),
        quantity: it.qty,
        unit_price: String(it.unitPrice),
        design_notes: it.notes ?? null,
        status: ["delivered", "cancelled"].includes(cfg.status) ? (cfg.status === "cancelled" ? "cancelled" : "delivered") : cfg.status,
        created_at: cfg.createdAt ?? now(-96),
      });

      // work tasks for stages that make sense for the current status
      const stageOrder = ["cutting", "stitching", "finishing"];
      const reachedIdx = { draft: -1, requested: -1, confirmed: 0, cutting: 0, stitching: 1, finishing: 2, trial_ready: 3, alteration: 2, ready: 4, delivered: 5, on_hold: 1, cancelled: -1 }[cfg.status];
      const stageWorker = { cutting: "আমিনুল ইসলাম", stitching: "সোহেল রানা", finishing: "রফিকুল ইসলাম" };
      const stageRate = { cutting: 60, stitching: it.garment === "shirt" ? 160 : 220, finishing: 70 };
      for (let i = 0; i < stageOrder.length; i++) {
        const st = stageOrder[i];
        if (i > reachedIdx) continue;
        const done = i < reachedIdx || cfg.status === "delivered";
        const inProgress = i === reachedIdx && !done && ["cutting", "stitching", "finishing"].includes(cfg.status);
        await ins("tasks", {
          order_item_id: itemId,
          stage: st,
          worker_id: workers[stageWorker[st]],
          status: cfg.status === "delivered" || done ? "qc_passed" : inProgress ? "in_progress" : "assigned",
          piece_rate: stageRate[st],
          assigned_at: now(-90),
          started_at: inProgress || done ? now(-40) : null,
          completed_at: done ? now(-6) : null,
          qc_note: done ? "যাচাই সম্পন্ন" : null,
        });
      }
    }

    // status history
    const chain = { draft: ["draft"], requested: ["requested"], confirmed: ["confirmed"], cutting: ["confirmed", "cutting"], stitching: ["confirmed", "cutting", "stitching"], finishing: ["confirmed", "cutting", "stitching", "finishing"], trial_ready: ["confirmed", "cutting", "stitching", "finishing", "trial_ready"], alteration: ["confirmed", "cutting", "stitching", "finishing", "trial_ready", "alteration"], ready: ["confirmed", "cutting", "stitching", "finishing", "ready"], delivered: ["confirmed", "cutting", "stitching", "finishing", "ready", "delivered"], on_hold: ["confirmed", "cutting", "on_hold"], cancelled: ["confirmed", "cancelled"] }[cfg.status] ?? [cfg.status];
    for (let i = 0; i < chain.length; i++) {
      await ins("order_status_history", {
        order_id: orderId,
        from_status: i === 0 ? null : chain[i - 1],
        to_status: chain[i],
        note: i === chain.length - 1 ? (cfg.historyNote ?? null) : null,
        changed_by: i % 2 === 0 ? "মোঃ সাইফুল ইসলাম" : "রুবেল হোসেন",
        changed_at: now(-90 + i * 10),
      });
    }

    // payments
    if (paid > 0) {
      await ins("payments", {
        order_id: orderId,
        customer_id: customers[cfg.phone],
        amount: String(paid),
        method: cfg.payMethod ?? "cash",
        kind: cfg.paid === total ? "final" : "advance",
        received_by: "রুবেল হোসেন",
        received_at: now(-88),
        receipt_no: `RC-${String(seq * 7).padStart(5, "0")}`,
        created_at: now(-88),
      });
    }
    return orderId;
  }

  const o = {};
  o.overdue = await addOrder({
    phone: "01611556677", status: "stitching", priority: "urgent", deliveryDate: iso(-3), orderDate: iso(-12),
    paid: 1500, notes: "জরুরি — অফিসের ইভেন্টের জন্য", historyNote: "ডেডলাইন পেরিয়ে যাওয়ায় অগ্রাধিকার দেওয়া হয়েছে",
    items: [{ garment: "shirt", profileId: p4, setId: s_shirt4, unitPrice: 950, qty: 2, fabricQty: 4.5 }],
  });
  o.dueToday = await addOrder({
    phone: "01712345678", status: "ready", deliveryDate: iso(0), orderDate: iso(-8), paid: 2000, payMethod: "bkash",
    items: [{ garment: "panjabi", profileId: p1, setId: s_panjabi, unitPrice: 1850, qty: 1, fabricQty: 2.5 }, { garment: "pant", profileId: p1, setId: s_pant, unitPrice: 1250, qty: 1, fabricQty: 1.75 }],
  });
  o.trialToday = await addOrder({
    phone: "01521447788", status: "trial_ready", deliveryDate: iso(3), trialDate: iso(0), orderDate: iso(-14), paid: 3000,
    notes: "ট্রায়াল আজ বিকাল ৫টা",
    items: [{ garment: "kameez", profileId: p5, setId: s_kameez5, unitPrice: 4400, qty: 1, fabricQty: 3.5, fabricSource: "customer" }],
  });
  o.cutting = await addOrder({
    phone: "01911223344", status: "cutting", deliveryDate: iso(4), orderDate: iso(-3), paid: 1200,
    items: [{ garment: "shirt", profileId: p3, setId: s_shirt3, unitPrice: 950, qty: 2, fabricQty: 4.5 }, { garment: "pant", profileId: p3, setId: s_pant3, unitPrice: 1250, qty: 1, fabricQty: 1.75 }],
  });
  o.finishing = await addOrder({
    phone: "01844556677", status: "finishing", deliveryDate: iso(1), orderDate: iso(-9), paid: 850,
    items: [{ garment: "blouse", profileId: p8, setId: s_blouse8, unitPrice: 850, qty: 1, fabricQty: 1.25 }],
  });
  o.confirmed = await addOrder({
    phone: "01312998877", status: "confirmed", deliveryDate: iso(7), orderDate: iso(-1), paid: 1500,
    items: [{ garment: "kameez", profileId: p6, setId: s_kameez6, unitPrice: 2200, qty: 2, fabricQty: 6 }],
  });
  o.onHold = await addOrder({
    phone: "01713445566", status: "on_hold", deliveryDate: iso(5), orderDate: iso(-6), paid: 500,
    notes: "কাস্টমার নিজের কাপড় এনে দেবেন — অপেক্ষায়",
    items: [{ garment: "shirt", profileId: p7, setId: s_shirt7, unitPrice: 950, qty: 3, fabricQty: 0, fabricSource: "customer" }],
  });
  o.requested = await addOrder({
    phone: "01977665544", status: "requested", deliveryDate: iso(9), orderDate: iso(0), source: "online", paid: 0,
    notes: "অনলাইন অনুরোধ: একই মাপে আবার ২টি পাঞ্জাবি", historyNote: "ওয়েবসাইট থেকে অনুরোধ এসেছে",
    items: [{ garment: "shirt", profileId: p9, setId: s_shirt9, unitPrice: 950, qty: 2, fabricQty: 4.5 }],
  });
  o.alteration = await addOrder({
    phone: "01819876543", status: "alteration", type: "alteration", deliveryDate: iso(2), orderDate: iso(-5), paid: 0,
    notes: "ট্রায়ালে কোমর ১ ইঞ্চি ঢিলা — সংশোধন চলছে",
    items: [{ garment: "kameez", profileId: p2, setId: s_kameez, unitPrice: 600, qty: 1, fabricQty: 0, fabricSource: "customer" }],
  });
  o.delivered1 = await addOrder({
    phone: "01712345678", status: "delivered", deliveryDate: iso(-5), orderDate: iso(-16), paid: 2200,
    items: [{ garment: "shirt", profileId: p1, setId: s_shirt, unitPrice: 950, qty: 1, fabricQty: 2.25 }, { garment: "pant", profileId: p1, setId: s_pant, unitPrice: 1250, qty: 1, fabricQty: 1.75 }],
  });
  o.delivered2 = await addOrder({
    phone: "01677889900", status: "delivered", deliveryDate: iso(-12), orderDate: iso(-24), paid: 2400, payMethod: "nagad",
    items: [{ garment: "kameez", profileId: p10, setId: s_kameez10, unitPrice: 2400, qty: 1, fabricQty: 3.25 }],
  });
  o.kid = await addOrder({
    phone: "01712345678", status: "confirmed", deliveryDate: iso(6), orderDate: iso(-2), paid: 900,
    notes: "ছেলে সাকিবের স্কুল ছুটির শার্ট",
    items: [{ garment: "shirt", profileId: pKid, setId: s_kid, unitPrice: 950, qty: 2, fabricQty: 3 }],
  });
  o.cancelled = await addOrder({
    phone: "01312998877", status: "cancelled", deliveryDate: iso(-1), orderDate: iso(-10), paid: 0,
    notes: "কাস্টমার অন্য দোকান থেকে নিয়েছেন",
    items: [{ garment: "pajama", profileId: p3, setId: s_pajama3, unitPrice: 900, qty: 1, fabricQty: 1.5 }],
  });

  /* ------------------------------------------------------------ appointments */

  const appts = [
    { name: "সাবরিনা আক্তার", phone: "01819876543", purpose: "নতুন মাপ", day: 0, hour: 17, cid: customers["01819876543"] },
    { name: "রহিমউদ্দিন আহমেد", phone: "01712345678", purpose: "ট্রায়াল", day: 0, hour: 18, cid: customers["01712345678"] },
    { name: "মিজানুর রহমান", phone: "01977665544", purpose: "নতুন মাপ", day: 1, hour: 11, cid: customers["01977665544"] },
    { name: "ফরহানা ইসলাম", phone: "01312998877", purpose: "পরামর্শ", day: 2, hour: 16, cid: customers["01312998877"] },
  ];
  for (const a of appts) {
    const start = new Date();
    start.setDate(start.getDate() + a.day);
    start.setHours(a.hour, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60_000);
    await ins("appointments", {
      customer_id: a.cid,
      name: a.name,
      phone: `+88${a.phone}`,
      purpose: a.purpose,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: "confirmed",
      location_type: "shop",
    });
  }

  /* -------------------------------------------------------------- expenses */

  const expenseRows = [
    { cat: "ভাড়া", amt: 18000, day: -12, note: "মাসিক দোকান ভাড়া" },
    { cat: "কাপড় ক্রয়", amt: 42500, day: -8, note: "নারায়ণগঞ্জ থেকে বাল্ক ক্রয়" },
    { cat: "সুতা-বোতাম", amt: 6300, day: -6, note: "বোতাম ও থ্রেড" },
    { cat: "বিদ্যুৎ", amt: 3400, day: -4, note: "বিদ্যুৎ বিল" },
    { cat: "যাতায়াত", amt: 900, day: -2, note: "কাপড় সংগ্রহ" },
    { cat: "মজুরি", amt: 21000, day: -1, note: "সাপ্তাহিক অগ্রিম" },
  ];
  for (const e of expenseRows) {
    await ins("expenses", { category: e.cat, amount: e.amt, date: iso(e.day), method: "cash", note: e.note, entered_by: "নাজমুল হক" });
  }

  /* --------------------------------------------------------- notifications */

  const notifRows = [
    { code: "order.confirmed", to: "+8801712345678", body: "আসসালামু আলাইকুম রহিমউদ্দিন, আপনার অর্ডার নিশ্চিত হয়েছে। ডেলিভারি: আজ। ট্র্যাক: tailorpro.app/t/xxx", status: "delivered", order: null },
    { code: "order.ready", to: "+8801844556677", body: "আপনার অর্ডার তৈরি। বকেয়া ৳০। আসার সময়: বিকাল ৫টা। — রহমান টেইলার্স", status: "delivered", order: null },
    { code: "order.trial_ready", to: "+8801521447788", body: "আপনার পোশাকের ট্রায়ালের জন্য আজ দোকানে আসুন। — রহমান টেইলার্স", status: "sent", order: null },
    { code: "payment.due_reminder", to: "+8801611556677", body: "আপনার অর্ডারের বকেয়া ৳১,৪০০ পরিশোধ করুন। — রহমান টেইলার্স", status: "queued", order: null },
  ];
  for (const n of notifRows) {
    await ins("notifications", {
      channel: "sms",
      recipient: n.to,
      template_code: n.code,
      body: n.body,
      status: n.status,
      related_order_id: n.order,
      sent_at: n.status === "queued" ? null : now(-10),
      created_at: now(-11),
    });
  }

  for (const [table, expected] of Object.entries(EXPECTED_COUNTS)) {
    if (insertedIds[table]?.length !== expected) {
      throw new Error(`Seed verification failed for ${table}: expected ${expected} records, inserted ${insertedIds[table]?.length ?? 0}`);
    }
  }
  await c.query("INSERT INTO settings (key, value) VALUES ($1, $2)", [
    SEED_KEY,
    { version: SEED_VERSION, rows: insertedIds },
  ]);

  console.log("Seeded:", {
    garments: Object.keys(garments).length,
    customers: Object.keys(customers).length,
    orders: seq - 41,
    workers: Object.keys(workers).length,
  });
  console.log("Local demo logins: admin@rahimantailors.com / admin123; worker@rahimantailors.com / worker123");
  console.log("Other staff: manager@rahimantailors.com / manager123; reception@rahimantailors.com / reception123; master@rahimantailors.com / master123");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
let client;
try {
  client = await pool.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(73482911)");
  await seed(client);
  await client.query("COMMIT");
} catch (error) {
  if (client) await client.query("ROLLBACK").catch(() => {});
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
