require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, "data");
const REQUESTS_FILE = path.join(DATA_DIR, "requests.json");
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";
const OFFICE_EMAIL = process.env.OFFICE_EMAIL || "rajarajaswaratoursandtravels@gmail.com";

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(REQUESTS_FILE)) fs.writeFileSync(REQUESTS_FILE, "[]", "utf8");

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

function readRequests() {
  try {
    const parsed = JSON.parse(fs.readFileSync(REQUESTS_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveRequests(items) {
  fs.writeFileSync(REQUESTS_FILE, JSON.stringify(items, null, 2), "utf8");
}
function clean(value, max = 500) {
  return String(value ?? "").trim().replace(/[<>]/g, "").slice(0, max);
}
function validPhone(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits.length >= 8 && digits.length <= 15;
}
function requireAdmin(req, res, next) {
  if (!ADMIN_API_KEY) {
    return res.status(503).json({ error: "Admin API is disabled. Set ADMIN_API_KEY in .env first." });
  }
  const supplied = req.get("x-admin-key") || "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(ADMIN_API_KEY);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Unauthorised" });
  }
  next();
}

function buildMailer() {
  // Email notifications are enabled only after SMTP settings are added to .env.
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function notifyOffice(requestItem) {
  const transporter = buildMailer();
  if (!transporter) {
    console.warn("Office email notification not sent: configure SMTP_HOST, SMTP_USER and SMTP_PASS in .env.");
    return false;
  }
  const subject = `[Website ${requestItem.intent}] ${requestItem.service} — ${requestItem.name}`;
  const text = [
    "New website request — Rajarajeswari Tours & Travels",
    "",
    `Request ID: ${requestItem.id}`,
    `Received: ${requestItem.createdAt}`,
    `Request type: ${requestItem.intent}`,
    `Service: ${requestItem.service}`,
    `Name: ${requestItem.name}`,
    `Phone: ${requestItem.phone}`,
    `Email: ${requestItem.email || "Not provided"}`,
    `Travel date: ${requestItem.travelDate || "Not provided"}`,
    `Destination / route: ${requestItem.destination || "Not provided"}`,
    `Travellers: ${requestItem.travellers || "Not provided"}`,
    "",
    "Additional details:",
    requestItem.message || "None",
    "",
    "Note: This is a request, not a confirmed booking. Please contact the customer to confirm availability and final pricing."
  ].join("\n");

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: OFFICE_EMAIL,
    replyTo: requestItem.email || undefined,
    subject,
    text
  });
  return true;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "Rajarajeswari Tours & Travels API" });
});

app.post("/api/requests", async (req, res) => {
  const body = req.body || {};
  const name = clean(body.name, 100);
  const phone = clean(body.phone, 30);
  const email = clean(body.email, 150);
  const intent = clean(body.intent, 40);
  const service = clean(body.service, 80);
  const travelDate = clean(body.travelDate, 30);
  const destination = clean(body.destination, 160);
  const travellers = clean(body.travellers, 30);
  const message = clean(body.message, 2000);
  const website = clean(body.website, 200);

  if (website) return res.status(201).json({ ok: true, message: "Thank you for contacting Rajarajeswari Tours & Travels. Please visit us again!" });
  if (!name || !phone || !intent || !service) {
    return res.status(400).json({ error: "Please provide your name, phone number, request type and service." });
  }
  if (!validPhone(phone)) {
    return res.status(400).json({ error: "Please enter a valid phone number." });
  }
  if (!["Request booking", "General enquiry"].includes(intent)) {
    return res.status(400).json({ error: "Please choose a valid request type." });
  }
  if (!["Flight tickets", "Cab / car rental", "Visa assistance", "Airport pick-up / drop", "Honeymoon package", "Custom tour package"].includes(service)) {
    return res.status(400).json({ error: "Please choose a valid service." });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address or leave it blank." });
  }

  const item = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "new",
    name, phone, email, intent, service,
    travelDate, destination, travellers, message
  };
  const items = readRequests();
  items.unshift(item);
  saveRequests(items);

  let officeEmailSent = false;
  try {
    officeEmailSent = await notifyOffice(item);
  } catch (err) {
    console.error("Office notification email failed:", err.message);
  }

  res.status(201).json({
    ok: true,
    id: item.id,
    officeEmailSent,
    message: "Thank you for contacting Rajarajeswari Tours & Travels! Your details have been received. Please visit us again. Our team will contact you about your request. This is not a confirmed booking."
  });
});

app.get("/api/admin/requests", requireAdmin, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
  res.json({ requests: readRequests().slice(0, limit) });
});

app.patch("/api/admin/requests/:id/status", requireAdmin, (req, res) => {
  const allowed = ["new", "contacted", "confirmed", "closed"];
  const status = clean(req.body?.status, 30);
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status." });
  const items = readRequests();
  const item = items.find((x) => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Request not found." });
  item.status = status;
  item.updatedAt = new Date().toISOString();
  saveRequests(items);
  res.json({ ok: true, request: item });
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again later." });
});

app.listen(PORT, () => {
  console.log(`Rajarajeswari Tours & Travels website running at http://localhost:${PORT}`);
});
