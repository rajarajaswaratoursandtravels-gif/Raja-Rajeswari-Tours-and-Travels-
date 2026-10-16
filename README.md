# Rajarajeswari Tours & Travels — Full-stack website

## Customer submit flow
After the customer clicks **Send Request**, the frontend sends the details to the backend.
The backend saves the request in `data/requests.json` and shows:
> Thank you for contacting Rajarajeswari Tours & Travels! Your details have been received. Please visit us again.

The request is **not a confirmed booking**. Your team should contact the customer to confirm availability, price and terms.

## Office email notifications
The backend is set to notify `rajarajaswaratoursandtravels@gmail.com` when a request arrives, but email delivery requires SMTP configuration:
1. Copy `.env.example` to `.env`.
2. Add SMTP_HOST, SMTP_USER, SMTP_PASS and any provider-specific port/security values.
3. Set MAIL_FROM to an address allowed by your email provider.
4. Restart the server and submit a test request.
5. Check the office inbox and spam folder.

For Gmail, use an App Password (with 2-Step Verification enabled) rather than your normal account password. Keep `.env` private and never commit it to a public repository. SMTP settings depend on your email provider.

## Run locally
Requirements: Node.js 18+ and npm.

```bash
npm install
```
Copy `.env.example` to `.env`, set a long private ADMIN_API_KEY, configure SMTP if office email alerts are required, then run:

```bash
npm start
```

Open http://localhost:3000.

## API
- `GET /api/health`
- `POST /api/requests`
- `GET /api/admin/requests` (requires `x-admin-key`)
- `PATCH /api/admin/requests/:id/status` (requires `x-admin-key`)

## Included
- `public/index.html`: responsive premium blue-and-gold frontend
- `server.js`: Express backend
- `package.json`: dependencies and scripts
- `.env.example`: environment configuration
- `README.md`: setup instructions

## Production notes
This starter stores requests in a JSON file, which is suitable for a small demo only. Use a database and backups for production. Add HTTPS, rate limiting, monitoring, and a secure admin dashboard before public launch. No live flight inventory, cab dispatch, payment processing, or visa application system is connected.
