# Security Fixes Required

## Critical - Requires Manual Action

### 1. JWT Secret Management
**Location:** `.env` file and `server/auth-middleware.ts`

**Current Issue:** JWT secret is hardcoded and exposed in version control.

**Fix:**
```bash
# Generate a secure secret
openssl rand -base64 64

# Add to .env (replace the current weak secret)
JWT_SECRET=<generated-secret-here>
```

### 2. Remove Exposed Secret File
**Location:** Project root

**Issue:** A file literally named `JWT_SECRET=marie-vault-super-secret-key-2025-change-in-production` exists, exposing the secret.

**Fix:**
```bash
rm "/root/maries-vault-migration/maries-vault/JWT_SECRET=marie-vault-super-secret-key-2025-change-in-production"
```

### 3. Database Credentials
**Location:** `.env`

**Current:** `DATABASE_URL=postgresql://mariesvault:vault123@localhost:5432/mariesvault`

**Fix:**
```bash
# Change PostgreSQL password
sudo -u postgres psql -c "ALTER USER mariesvault WITH PASSWORD 'new-secure-password-here';"

# Update .env with new password
DATABASE_URL=postgresql://mariesvault:<new-password>@localhost:5432/mariesvault
```

### 4. Authentication Passcode
**Location:** `server/auth-middleware.ts:98`

**Current:** Hardcoded passcode `"13"`

**Fix:** Move to environment variable:
```bash
# Add to .env
AUTH_PASSCODE=<your-secure-passcode>
```

Then update `auth-middleware.ts`:
```typescript
const AUTH_PASSCODE = process.env.AUTH_PASSCODE || "change-me";
// ...
if (passcode !== AUTH_PASSCODE) {
```

### 5. Enforce HTTPS Cookies
**Location:** `server/auth-middleware.ts:121`

**Current:** `secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true'`

**Fix:** In production, always use secure cookies:
```typescript
secure: process.env.NODE_ENV === 'production',
```

---

## Environment Variables Checklist

Your `.env` should contain:
```
DATABASE_URL=postgresql://mariesvault:<secure-password>@localhost:5432/mariesvault
PORT=4000
NODE_ENV=production
JWT_SECRET=<64-char-random-string>
AUTH_PASSCODE=<your-passcode>
```

---

## After Applying Fixes

1. Restart the application: `pm2 restart all` or restart your node process
2. Clear browser cookies and re-authenticate
3. Verify the exposed secret file is deleted
4. Consider adding `.env` to `.gitignore` if not already present
