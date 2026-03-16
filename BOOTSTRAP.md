# Bootstrap Guide — Marie's Vault

Full setup guide from zero to running instance.

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- A server or local machine (Linux/macOS recommended)

---

## 1. Clone & Install

```bash
git clone https://github.com/MarieVault/maries-vault.git
cd maries-vault
npm install
```

---

## 2. Database

Create a PostgreSQL database:

```bash
psql -U postgres
CREATE DATABASE maries_vault;
CREATE USER vault_user WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE maries_vault TO vault_user;
\q
```

---

## 3. Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://vault_user:yourpassword@localhost:5432/maries_vault

# Session
SESSION_SECRET=pick-a-long-random-string-here

# Server
PORT=4000
NODE_ENV=production

# Upload storage (where files are saved)
UPLOAD_DIR=./uploads
```

---

## 4. Run Migrations

Push the schema to your database:

```bash
npm run db:push
```

---

## 5. Create Upload Directory

```bash
mkdir -p uploads
```

---

## 6. Build & Start

```bash
# Production
npm run build
npm start

# Development (hot reload)
npm run dev
```

App runs on `http://localhost:4000` by default.

---

## 7. Reverse Proxy (nginx)

Recommended nginx config to expose on port 80:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then get SSL via certbot:

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

---

## 8. Process Management (PM2)

Keep the app running after logout:

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## 9. Twitter/X Import Setup

The Twitter import feature works out of the box — just paste a tweet URL into the import dialog. No API key required (uses public embed data).

For video imports, `yt-dlp` is recommended:

```bash
# Ubuntu/Debian
apt install yt-dlp

# or via pip
pip install yt-dlp
```

---

## Folder Structure

```
client/          React frontend source
server/          Express backend
  routes/        API route handlers
  storage.ts     File & DB storage logic
shared/          Shared TypeScript types/schemas
migrations/      Drizzle DB migrations
uploads/         User uploaded files (not in git)
```

---

## Upgrading

```bash
git pull
npm install
npm run db:push   # apply any new migrations
npm run build
pm2 restart all
```

---

## Troubleshooting

**App won't start**
- Check `DATABASE_URL` is correct and PostgreSQL is running
- Check `SESSION_SECRET` is set

**Uploads not saving**
- Check `uploads/` directory exists and is writable
- Check `UPLOAD_DIR` in `.env`

**Twitter import fails**
- Some tweets are private or deleted — nothing to import
- For video, make sure `yt-dlp` is installed

---

## License

MIT — use it, fork it, build on it.
