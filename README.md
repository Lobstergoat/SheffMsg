# SheffMsg — QR Message Board

A clean, secure, and simple app: scan a QR code, see the latest message for that location, leave a new message for the next person. Includes an admin view to list and manage messages.

## Features
- Latest message per location (via `?location=...` in the URL)
- Submit new messages with validation and rate limiting
- Admin panel (Basic Auth) to browse, filter, and delete
- SQLite database for simplicity (file-based), easy to run locally
- Security: Helmet (CSP), input validation, safe rendering

## Quick Start (Local)
1. Requirements: Node.js 18+.
2. Install dependencies:
```
npm install
```
3. Create environment file (optional):
```
cp env.sample .env
# Edit .env to set ADMIN_USER/ADMIN_PASS and PUBLIC_BASE_URL if desired
```
4. Run DB migration:
```
npm run migrate
```
5. Start the server (dev):
```
npm run dev
```
6. Open `http://localhost:3000`.
   - Try `http://localhost:3000/?location=park-1`
   - Admin: `http://localhost:3000/admin` (default `admin` / `changeme`)

## API
- GET `/api/message?location=park-1`
  - Returns `{ location, message, createdAt }` (or `message: null`)
- POST `/api/message`
  - Body: `{ location: "park-1", message: "hello" }`
  - Returns `{ ok: true, location, createdAt }`
- Admin GET `/api/admin/messages?location=&page=&limit=` (Basic Auth)
- Admin DELETE `/api/admin/messages/:id` (Basic Auth)

## QR Code Generation
Generate PNG QR codes for one or more location IDs:
```
npm run qr -- park-1 cafe-2 library-3
# Files saved to ./qrs (uses PUBLIC_BASE_URL)
```

## Deployment
### Docker (recommended)
```
docker compose up --build -d
```
- Port 3000 on host
- Persists SQLite DB under `./data`
- Configure env via `.env` or docker-compose

### Bare Metal / VM
- Install Node 18+
- `npm ci --omit=dev`
- `npm run migrate`
- `NODE_ENV=production PORT=3000 ADMIN_USER=... ADMIN_PASS=... node src/app.js`
- Put behind a reverse proxy with HTTPS (Let’s Encrypt)

### Security Notes
- Helmet CSP; safe `textContent` rendering
- Message length max 100; trimmed
- Rate limit on POST
- Use HTTPS and strong admin creds

## Database
- SQLite file at `./data/messages.db`
- Table: `messages(id, location, message, created_at)`

## Customization
- Styling in `public/styles.css`
- Limits in `src/app.js`

## Troubleshooting
- If port is taken, set `PORT` in `.env`
- If admin fetch fails, ensure Basic Auth prompt appears and creds are correct
