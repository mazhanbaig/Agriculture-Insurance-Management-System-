# Manual Testing Guide — AIMS

## 1. Start Local Environment

**Terminal 1 — Backend** (`C:\Users\kk\Desktop\AIMS`):
```powershell
npm run dev
```
Wait for: `"Server running on port 4000"` + `"Database connection successful"`

**Terminal 2 — Frontend** (`C:\Users\kk\Desktop\AIMSFrontend`):
```powershell
npm run dev
```
Opens at `http://localhost:3000`

---

## 2. Switch Frontend to Local Backend

Edit `C:\Users\kk\Desktop\AIMSFrontend\.env.local` — swap the API URL:

```
# ⚡ Production - COMMENT this out
# NEXT_PUBLIC_API_URL=https://agriculture-insurance-management-system.up.railway.app

# 🖥️ Local - UNCOMMENT this
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Restart the frontend dev server after changing.

---

## 3. Seed Test Users

```powershell
curl.exe -Method POST -Uri "http://localhost:4000/api/v1/dev/auth/seed" -Headers @{"Content-Type"="application/json"} -Body '{"name":"Admin User","email":"admin@test.com","role":"PLATFORM_ADMIN"}'
```

Repeat for each role:

| Role | Email | Body Name |
|------|-------|-----------|
| `PLATFORM_ADMIN` | `admin@test.com` | `Admin User` |
| `TENANT_ADMIN` | `tenant@test.com` | `Tenant Admin` |
| `CLAIMS_OFFICER` | `claims@test.com` | `Claims Officer` |
| `UNDERWRITER` | `underwriter@test.com` | `Underwriter` |
| `FARMER` | `farmer@test.com` | `John Farmer` |

---

## 4. Test via Dev Login

Go to `http://localhost:3000/dev-login` — click any user to instantly log in (no password).

### Farmer Flow
- Dashboard — view stats, policies, claims
- Farmers > Profile — create/update farmer profile
- Farmers > Land Parcels — add/delete land parcels
- My Policies — view purchased policies
- Purchase Policy — buy new policy
- My Claims — view submitted claims
- Submit Claim — file a new claim

### Admin Flow (login as TENANT_ADMIN or CLAIMS_OFFICER)
- Admin Dashboard — aggregate stats
- Manage Farmers — list/search farmers
- Manage Claims — view, assign, approve/reject claims
- Manage Staff — create/update staff users
- Settings — tenant settings, fraud tier, IAM roles
- Billing — view subscription, invoices

### Platform Admin Flow (login as PLATFORM_ADMIN)
- Tenants — list, create, approve, suspend tenants
- Platform Analytics — tenant-wide metrics

---

## 5. Run Automated Tests

**Backend tests:**
```powershell
cd C:\Users\kk\Desktop\AIMS
npx jest
```

**Frontend tests:**
```powershell
cd C:\Users\kk\Desktop\AIMSFrontend
npx jest
```

---

## 6. API Smoke Test (Backend)

```powershell
# Health check
curl.exe http://localhost:4000/health

# List policy plans (public)
curl.exe http://localhost:4000/api/v1/policy-plans

# Register a new user (via Supabase — has rate limits)
curl.exe -Method POST -Uri "http://localhost:4000/api/v1/auth/register" -Headers @{"Content-Type"="application/json"} -Body '{"name":"Test User","email":"test@example.com","password":"Test123!","role":"FARMER"}'
```

---

## 7. Test Data Flow (End-to-End)

1. Login as **FARMER** at `/dev-login`
2. Go to **Farmers > Profile** and fill in farmer details
3. Go to **Farmers > Land Parcels** and add a land parcel
4. Go to **Purchase Policy** and buy a policy
5. Go to **Submit Claim** and file a claim against the policy
6. Logout and login as **CLAIMS_OFFICER**
7. Go to **Manage Claims** — verify the claim appears
8. Assign the claim to yourself and change status to APPROVED
9. Login as **FARMER** again — verify claim status updated
