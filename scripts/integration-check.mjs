/**
 * Local development integration checks. Writes are limited to uniquely marked
 * test records, and cleanup uses their exact IDs. Run after npm run setup/dev.
 */
import { createHmac, randomInt, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { loadProjectEnv } from "./lib/env.mjs";

loadProjectEnv();
let checks = 0;
class CheckFailure extends Error {}
function check(condition, label) {
  if (!condition) throw new CheckFailure(label);
  checks += 1;
}
function localUrl(value, kind) {
  let url;
  try { url = new URL(value); } catch { throw new CheckFailure(`${kind} must be a valid loopback URL`); }
  const localHosts = ["localhost", "127.0.0.1", "[::1]", "::1"];
  check(localHosts.includes(url.hostname.toLowerCase()), `${kind} must use a loopback host`);
  const protocols = kind === "DATABASE_URL" ? ["postgres:", "postgresql:"] : ["http:", "https:"];
  check(protocols.includes(url.protocol), `${kind} has an unsupported protocol`);
  if (kind === "APP_URL") check(!url.username && !url.password && url.pathname === "/" && !url.search && !url.hash, "APP_URL must contain only the local origin");
  return url;
}

check(process.env.LOCAL_DEMO_MODE === "true", "LOCAL_DEMO_MODE=true is required for test writes");
check(Boolean(process.env.DATABASE_URL), "DATABASE_URL is required");
localUrl(process.env.DATABASE_URL, "DATABASE_URL");
const app = localUrl(process.env.APP_URL || "http://localhost:3000", "APP_URL");
check(typeof process.env.AUTH_SECRET === "string" && process.env.AUTH_SECRET.length >= 32, "A configured AUTH_SECRET is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, application_name: "tailorpro-integration-check", connectionTimeoutMillis: 5000, max: 3 });
const runId = randomUUID();
const marker = "integration:" + runId;
const customerIds = new Set();
const orderIds = new Set();
const userIds = new Set();
const appointmentIds = new Set();
const ownedCustomerKeys = [];
const unknownEmail = `integration-${runId}@example.invalid`;

function jar() {
  const values = new Map();
  return {
    header: () => [...values].map(([key, value]) => `${key}=${value}`).join("; "),
    set: (key, value) => values.set(key, value),
    read: (response) => {
      for (const cookie of response.headers.getSetCookie()) {
        const first = cookie.split(";")[0];
        const equal = first.indexOf("=");
        if (equal > 0) values.set(first.slice(0, equal), first.slice(equal + 1));
      }
    },
  };
}
async function request(path, { method = "GET", body, cookies } = {}) {
  const headers = { accept: "application/json, text/html" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookies?.header()) headers.cookie = cookies.header();
  let response;
  try {
    response = await fetch(new URL(path, app), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual", signal: AbortSignal.timeout(30000) });
  } catch { throw new CheckFailure(`HTTP ${method} ${path} is unavailable`); }
  cookies?.read(response);
  const raw = method === "HEAD" ? "" : await response.text();
  let data = null;
  try { data = JSON.parse(raw); } catch { /* HTML is checked separately. */ }
  return { status: response.status, headers: response.headers, data, raw };
}
function status(result, expected, label) {
  check(result.status === expected, `${label}: expected HTTP ${expected}, received ${result.status}`);
}
async function together(jobs) {
  const results = await Promise.allSettled(jobs);
  const rejected = results.find((result) => result.status === "rejected");
  if (rejected) throw rejected.reason;
  return results.map((result) => result.value);
}
async function unusedPhone() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const phone = "+88013" + String(randomInt(10_000_000, 100_000_000));
    const result = await pool.query("SELECT id FROM customers WHERE phone = $1", [phone]);
    if (!result.rowCount) return phone;
  }
  throw new CheckFailure("Could not reserve a synthetic test phone");
}
function dhakaDate(offset) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + offset)).toISOString().slice(0, 10);
}
async function login(identifier, password, expectedRole) {
  const cookies = jar();
  const result = await request("/api/v1/auth/staff", { method: "POST", body: { identifier, password }, cookies });
  status(result, 200, expectedRole + " staff login");
  check(result.data?.role === expectedRole && cookies.header().includes("staff_session="), expectedRole + " login must issue a staff session");
  return cookies;
}

async function cleanup() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Discover only responses potentially lost to an HTTP timeout, using the
    // unique names/phones registered before their requests.
    for (const key of ownedCustomerKeys) {
      const found = await client.query("SELECT id FROM customers WHERE name = $1 AND phone = $2", [key.name, key.phone]);
      for (const row of found.rows) customerIds.add(row.id);
    }
    const foundUsers = await client.query("SELECT id FROM users WHERE email = $1", [unknownEmail]);
    for (const row of foundUsers.rows) userIds.add(row.id);
    if (customerIds.size) {
      const foundOrders = await client.query("SELECT id FROM orders WHERE customer_id = ANY($1::uuid[]) AND notes = $2", [[...customerIds], marker]);
      for (const row of foundOrders.rows) orderIds.add(row.id);
      const foundAppointments = await client.query("SELECT id FROM appointments WHERE customer_id = ANY($1::uuid[]) AND notes = $2", [[...customerIds], marker]);
      for (const row of foundAppointments.rows) appointmentIds.add(row.id);
    }
    const ids = [...orderIds];
    if (ids.length) {
      const notifications = await client.query("SELECT id FROM notifications WHERE related_order_id = ANY($1::uuid[])", [ids]);
      const payments = await client.query("SELECT id FROM payments WHERE order_id = ANY($1::uuid[])", [ids]);
      const history = await client.query("SELECT id FROM order_status_history WHERE order_id = ANY($1::uuid[])", [ids]);
      const items = await client.query("SELECT id FROM order_items WHERE order_id = ANY($1::uuid[])", [ids]);
      const tasks = await client.query("SELECT id FROM tasks WHERE order_item_id = ANY($1::uuid[])", [items.rows.map((row) => row.id)]);
      await client.query("DELETE FROM notifications WHERE id = ANY($1::uuid[])", [notifications.rows.map((row) => row.id)]);
      await client.query("DELETE FROM payments WHERE id = ANY($1::uuid[])", [payments.rows.map((row) => row.id)]);
      await client.query("DELETE FROM order_status_history WHERE id = ANY($1::uuid[])", [history.rows.map((row) => row.id)]);
      await client.query("DELETE FROM tasks WHERE id = ANY($1::uuid[])", [tasks.rows.map((row) => row.id)]);
      await client.query("DELETE FROM order_items WHERE id = ANY($1::uuid[])", [items.rows.map((row) => row.id)]);
      await client.query("DELETE FROM orders WHERE id = ANY($1::uuid[])", [ids]);
    }
    await client.query("DELETE FROM appointments WHERE id = ANY($1::uuid[])", [[...appointmentIds]]);
    if (customerIds.size) {
      const profiles = await client.query("SELECT id FROM measurement_profiles WHERE customer_id = ANY($1::uuid[])", [[...customerIds]]);
      const sets = await client.query("SELECT id FROM measurement_sets WHERE profile_id = ANY($1::uuid[])", [profiles.rows.map((row) => row.id)]);
      await client.query("DELETE FROM measurement_sets WHERE id = ANY($1::uuid[])", [sets.rows.map((row) => row.id)]);
      await client.query("DELETE FROM measurement_profiles WHERE id = ANY($1::uuid[])", [profiles.rows.map((row) => row.id)]);
      await client.query("DELETE FROM customers WHERE id = ANY($1::uuid[])", [[...customerIds]]);
    }
    if (userIds.size) {
      const workers = await client.query("SELECT id FROM workers WHERE user_id = ANY($1::uuid[])", [[...userIds]]);
      await client.query("DELETE FROM workers WHERE id = ANY($1::uuid[])", [workers.rows.map((row) => row.id)]);
      await client.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[...userIds]]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function run() {
  const health = await request("/api/health");
  status(health, 200, "database health");
  check(health.data?.ok === true, "health must confirm a live database");
  for (const image of ["hero-cutting-table", "hanging-garments", "trial-fitting", "sewing-machine", "fabric-stack", "chalk-tools"]) {
    const result = await request(`/images/${image}.jpg`, { method: "HEAD" });
    status(result, 200, image + " image");
    check(result.headers.get("content-type")?.startsWith("image/"), image + " must be served as an image");
  }
  for (const path of ["/", "/services", "/book", "/track", "/gallery", "/about", "/how-it-works", "/contact", "/staff-login", "/login"]) {
    const result = await request(path);
    status(result, 200, path + " public page");
    check(result.headers.get("content-type")?.includes("text/html") && result.raw.length > 100, path + " must render HTML");
  }

  const owner = (await pool.query("SELECT id, name, role FROM users WHERE email = $1 AND role = 'owner' AND is_active = true", ["admin@rahimantailors.com"])).rows[0];
  check(Boolean(owner), "Complete local demo seed is required");
  const probePhone = await unusedPhone();
  const probeName = "Integration probe " + runId;
  const probeId = randomUUID();
  ownedCustomerKeys.push({ name: probeName, phone: probePhone });
  await pool.query("INSERT INTO customers (id, name, phone, portal_enabled) VALUES ($1,$2,$3,false)", [probeId, probeName, probePhone]);
  customerIds.add(probeId);
  // A read-only cookie based on this local secret confirms that APP_URL is
  // connected to this exact local database before HTTP mutation checks.
  const payload = Buffer.from(JSON.stringify({ userId: owner.id, role: owner.role, workerId: null, purpose: "staff", exp: Math.floor(Date.now() / 1000) + 300 })).toString("base64url");
  const signature = createHmac("sha256", process.env.AUTH_SECRET).update(payload).digest("base64url");
  const probeCookie = jar();
  probeCookie.set("staff_session", payload + "." + signature);
  const probe = await request("/api/v1/customers/" + probeId, { cookies: probeCookie });
  status(probe, 200, "local database identity probe");
  check(probe.data?.id === probeId && probe.data?.name === probeName, "The running app must use this exact local database");

  const placeholder = randomUUID();
  const guarded = [
    ["/api/v1/customers", "GET"], ["/api/v1/customers/" + placeholder, "GET"],
    ["/api/v1/orders", "GET"], [`/api/v1/orders/${placeholder}/payments`, "GET"],
    ["/api/v1/customers", "POST"], ["/api/v1/measurements", "POST"], ["/api/v1/orders", "POST"],
    [`/api/v1/orders/${placeholder}/payments`, "POST"], [`/api/v1/orders/${placeholder}/status`, "POST"],
  ];
  for (const [path, method] of guarded) {
    status(await request(path, { method, ...(method === "POST" ? { body: {} } : {}) }), 401, "anonymous " + method + " " + path);
  }
  const beforeUsers = Number((await pool.query("SELECT count(*) AS n FROM users")).rows[0].n);
  const unknown = await request("/api/v1/auth/staff", { method: "POST", body: { identifier: unknownEmail, password: "integration-password" } });
  const unknownUsers = await pool.query("SELECT id FROM users WHERE email = $1", [unknownEmail]);
  for (const row of unknownUsers.rows) userIds.add(row.id);
  status(unknown, 401, "unknown staff must not register during login");
  check(Number((await pool.query("SELECT count(*) AS n FROM users")).rows[0].n) === beforeUsers, "Staff login must not create user records");

  const admin = await login("admin@rahimantailors.com", "admin123", "owner");
  const worker = await login("worker@rahimantailors.com", "worker123", "worker");
  const reception = await login("reception@rahimantailors.com", "reception123", "reception");
  for (const [path, method] of guarded) {
    status(await request(path, { method, cookies: worker, ...(method === "POST" ? { body: {} } : {}) }), 403, "worker " + method + " " + path);
  }
  status(await request("/api/v1/customers", { cookies: reception }), 200, "reception customer access");

  const phone = await unusedPhone();
  const name = "Integration customer " + runId;
  ownedCustomerKeys.push({ name, phone });
  const customer = await request("/api/v1/customers", { method: "POST", cookies: admin, body: { name, phone, tags: ["integration"] } });
  if (typeof customer.data?.id === "string") customerIds.add(customer.data.id);
  status(customer, 201, "create synthetic customer");
  const customerId = customer.data.id;
  const profiles = await request("/api/v1/customers/" + customerId, { cookies: admin });
  status(profiles, 200, "new customer profiles");
  check(profiles.data?.profiles?.length === 1 && profiles.data.profiles[0].is_default === true, "Customer creation must atomically create a default measurement profile");
  const profileId = profiles.data.profiles[0].id;
  const garment = (await pool.query("SELECT id, base_price, measurement_schema FROM garment_types WHERE is_active = true AND base_price > 25 ORDER BY sort_order LIMIT 1")).rows[0];
  check(Boolean(garment), "An active demo garment with a base price is required");
  const values = {};
  for (const group of garment.measurement_schema.groups) {
    for (const field of group.fields) {
      if (field.type === "measurement" || field.type === "number" || !field.type) values[field.key] = (Number(field.min ?? 1) + Number(field.max ?? 100)) / 2;
    }
  }
  const measurement = await request("/api/v1/measurements", { method: "POST", cookies: admin, body: { profile_id: profileId, garment_type_id: garment.id, unit_entered: "cm", values, verified: true } });
  status(measurement, 201, "create validated measurement snapshot");

  const activeWorkers = (await pool.query("SELECT w.id, w.role, w.name, u.email FROM workers w LEFT JOIN users u ON u.id = w.user_id WHERE w.is_active = true ORDER BY w.name")).rows;
  const linkedWorker = activeWorkers.find((row) => row.email === "worker@rahimantailors.com");
  check(Boolean(linkedWorker), "Demo worker must have an explicit active user link");
  const manual = Object.fromEntries(["cutting", "stitching", "finishing"].map((stage) => [stage, (activeWorkers.find((row) => row.id === linkedWorker.id && row.role === stage) ?? activeWorkers.find((row) => row.role === stage))?.id]));
  check(Object.values(manual).every(Boolean), "Each task stage needs an active demo worker");
  const order = await request("/api/v1/orders", { method: "POST", cookies: admin, body: {
    customer_id: customerId, delivery_date: dhakaDate(14), assignment_mode: "manual", manual_workers: manual, notes: marker,
    items: [{ garment_type_id: garment.id, profile_id: profileId, measurement_set_id: measurement.data.id, quantity: 2, fabric_source: "customer" }],
  } });
  if (typeof order.data?.id === "string") orderIds.add(order.data.id);
  status(order, 201, "create order without an explicit unit price");
  const orderId = order.data.id;
  const line = (await pool.query("SELECT unit_price, quantity, measurement_set_id FROM order_items WHERE order_id = $1", [orderId])).rows[0];
  check(Number(line?.unit_price) === Number(garment.base_price) && line.quantity === 2, "Order lines must retain the resolved garment base price");
  check(line.measurement_set_id === measurement.data.id, "Order must pin the submitted measurement snapshot");
  const createdOrder = (await pool.query("SELECT total, paid_amount, due_amount FROM orders WHERE id = $1", [orderId])).rows[0];
  check(Number(createdOrder.total) === Number(garment.base_price) * 2 && Number(createdOrder.paid_amount) === 0, "Order totals must agree with resolved line prices");
  const createdTasks = (await pool.query("SELECT t.id, t.worker_id FROM tasks t JOIN order_items i ON i.id = t.order_item_id WHERE i.order_id = $1", [orderId])).rows;
  const ownTask = createdTasks.find((task) => task.worker_id === linkedWorker.id);
  const foreignTask = createdTasks.find((task) => task.worker_id !== linkedWorker.id);
  check(Boolean(ownTask && foreignTask), "Order must create scoped tasks for different stage workers");
  status(await request("/worker/tasks/" + ownTask.id, { cookies: worker }), 200, "worker own task");
  status(await request("/worker/tasks/" + foreignTask.id, { cookies: worker }), 404, "worker foreign task");
  const foreignWorker = activeWorkers.find((row) => row.id === foreignTask.worker_id);
  const earnings = await request("/worker/earnings?w=" + foreignWorker.id, { cookies: worker });
  status(earnings, 200, "worker earnings scope");
  check(earnings.raw.includes(linkedWorker.name) && !earnings.raw.includes(foreignWorker.name), "Worker query parameters must not select another worker's earnings");

  const paymentBody = { amount: 25, method: "cash", kind: "installment", idempotencyKey: marker };
  const paymentPair = await together([request(`/api/v1/orders/${orderId}/payments`, { method: "POST", cookies: admin, body: paymentBody }), request(`/api/v1/orders/${orderId}/payments`, { method: "POST", cookies: admin, body: paymentBody })]);
  for (const result of paymentPair) status(result, 200, "concurrent idempotent payment");
  check(paymentPair[0].data.receipt_no === paymentPair[1].data.receipt_no, "Duplicate payments must return the same receipt");
  check(paymentPair.filter((result) => result.data.duplicate === true).length === 1, "Exactly one concurrent payment must be marked duplicate");
  const paid = (await pool.query("SELECT paid_amount, due_amount FROM orders WHERE id = $1", [orderId])).rows[0];
  const paymentCount = (await pool.query("SELECT count(*)::int AS n FROM payments WHERE order_id = $1", [orderId])).rows[0].n;
  check(paymentCount === 1 && Number(paid.paid_amount) === 25, "Concurrent retries must write one payment and add only 25");
  status(await request(`/api/v1/orders/${orderId}/payments`, { method: "POST", cookies: admin, body: { ...paymentBody, amount: 26 } }), 409, "changed idempotency payload");
  status(await request(`/api/v1/orders/${orderId}/payments`, { method: "POST", cookies: admin, body: { ...paymentBody, amount: Number(paid.due_amount) + 1, idempotencyKey: marker + ":over" } }), 409, "overpayment prevention");
  const scopedPayments = await request(`/api/v1/orders/${orderId}/payments?customer_id=${customerId}`, { cookies: admin });
  status(scopedPayments, 200, "scoped payment listing");
  check(scopedPayments.data?.payments?.length === 1 && scopedPayments.data.payments.every((row) => row.orderId === orderId && row.customerId === customerId), "Payment listing must return only the requested order/customer");
  status(await request(`/api/v1/orders/${orderId}/payments?customer_id=${probeId}`, { cookies: admin }), 404, "foreign customer payment listing");

  const otp = await request("/api/v1/auth/otp", { method: "POST", body: { action: "request", phone } });
  status(otp, 200, "local demo OTP request");
  check(otp.data?.demo === true && /^\d{6}$/.test(otp.data.dev_code), "Explicit local demo mode must return a six-digit test code");
  status(await request("/api/v1/auth/otp", { method: "POST", body: { action: "verify", phone, code: "000000" } }), 401, "incorrect OTP");
  const portal = jar();
  const verified = await request("/api/v1/auth/otp", { method: "POST", cookies: portal, body: { action: "verify", phone, code: otp.data.dev_code } });
  status(verified, 200, "customer OTP verification");
  check(verified.data?.customer_id === customerId, "OTP must authenticate the correct customer");
  for (const path of ["/account", "/account/orders", "/account/measurements", "/account/profile"]) status(await request(path, { cookies: portal }), 200, "authenticated " + path);
  status(await request("/api/v1/auth/otp", { method: "POST", body: { action: "verify", phone, code: otp.data.dev_code } }), 410, "one-time OTP replay");
  await pool.query("UPDATE customers SET portal_enabled = false WHERE id = $1", [customerId]);
  const disabledPortal = await request("/account", { cookies: portal });
  check([302, 303, 307, 308].includes(disabledPortal.status) && disabledPortal.headers.get("location")?.startsWith("/login"), "Disabling a customer's portal must invalidate its existing session");
  await pool.query("UPDATE customers SET portal_enabled = true WHERE id = $1", [customerId]);

  let slot;
  let date;
  for (let offset = 21; offset < 35; offset += 1) {
    const candidate = dhakaDate(offset);
    if (new Date(candidate + "T12:00:00Z").getUTCDay() === 5) continue;
    const available = await request("/api/v1/public/slots?date=" + candidate);
    status(available, 200, "future appointment slots");
    if (available.data?.slots?.length) { date = candidate; slot = available.data.slots[randomInt(available.data.slots.length)].start; break; }
  }
  check(Boolean(date && slot), "An unoccupied future appointment slot is required");
  const bookingBody = { name, phone, date, slot, purpose: "নতুন মাপ", notes: marker };
  const bookings = await together([request("/api/v1/public/appointments", { method: "POST", body: bookingBody }), request("/api/v1/public/appointments", { method: "POST", body: bookingBody })]);
  for (const result of bookings) if (typeof result.data?.id === "string") appointmentIds.add(result.data.id);
  check(bookings.map((result) => result.status).sort().join(",") === "201,409", "Concurrent bookings for one slot must accept exactly one request");
  for (const invalid of [{ date: "2026-02-30" }, { slot: "25:00" }, { slot: "10:17" }, { slot: "09:30" }]) {
    status(await request("/api/v1/public/appointments", { method: "POST", body: { ...bookingBody, ...invalid } }), 400, "invalid appointment date/time");
  }

  await pool.query("UPDATE orders SET status = 'ready' WHERE id = $1", [orderId]);
  await pool.query("UPDATE order_items SET status = 'ready' WHERE order_id = $1", [orderId]);
  status(await request(`/api/v1/orders/${orderId}/status`, { method: "POST", cookies: reception, body: { to: "delivered", override_due: true, override_reason: "Integration role check" } }), 403, "reception must not override unpaid delivery");
  check((await pool.query("SELECT status FROM orders WHERE id = $1", [orderId])).rows[0].status === "ready", "Rejected override must preserve order status");
  status(await request(`/api/v1/orders/${orderId}/status`, { method: "POST", cookies: admin, body: { to: "delivered" } }), 409, "unpaid delivery without override");
  status(await request(`/api/v1/orders/${orderId}/status`, { method: "POST", cookies: admin, body: { to: "delivered", override_due: true, override_reason: "Integration approved delivery" } }), 200, "owner may explicitly override unpaid delivery");
  const deliveryHistory = (await pool.query("SELECT changed_by FROM order_status_history WHERE order_id = $1 AND to_status = 'delivered'", [orderId])).rows;
  check(deliveryHistory.length === 1 && deliveryHistory[0].changed_by === owner.name, "Delivery override must record the authenticated staff actor");
}

let failure;
try { await run(); } catch (error) { failure = error; }
try { await cleanup(); } catch { failure = new CheckFailure("Test cleanup failed; review records marked " + marker); }
await pool.end();
if (failure) {
  console.error(failure instanceof CheckFailure ? "FAIL: " + failure.message : "FAIL: integration checks could not complete; check the local app/database setup");
  process.exitCode = 1;
} else {
  console.log(`PASS: ${checks} integration checks; temporary test records removed.`);
}
