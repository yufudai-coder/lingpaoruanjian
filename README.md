# Car License System

Cloudflare Workers + D1 licensing backend, mobile-friendly admin page, and Android Java/Kotlin SDK example.

## Important behavior

- Two independent products (`APP_A`, `APP_B`); activation codes are product-specific.
- One code binds to one Android installation identity (`ANDROID_ID` scoped by app signing key/user).
- Permanent license: server signs a compact JWT-like token with ECDSA P-256. The app verifies it locally and can remain offline indefinitely.
- Trial: 24 hours from first activation; the app must contact `/api/trial/check` while using trial access.
- Restore: the original activation code can restore the permanent signed token on the same device. A different device is rejected.
- Permanent offline licenses cannot be remotely revoked, expired, or unbound on the device after issuance. This is an unavoidable consequence of indefinite offline operation.

## 1. Create Cloudflare resources

Install Node.js and Wrangler on a computer or Android terminal (Termux):
```sh
npm install
npx wrangler login
npx wrangler d1 create license-db
```
Copy the returned `database_id` into `wrangler.toml`.

Initialize the database:
```sh
npx wrangler d1 execute license-db --remote --file=schema.sql
```

Create secrets:
```sh
npx wrangler secret put ADMIN_KEY
npx wrangler secret put SIGNING_KEY
```

`ADMIN_KEY`: long random admin password/token.
`SIGNING_KEY`: base64-encoded PKCS#8 DER private key for P-256 ECDSA. Generate it once and keep it secret:
```sh
node scripts/generate-signing-key.mjs
```
The script prints `SIGNING_KEY` and the corresponding public JWK. Put the private value in Cloudflare secret and the public JWK in `android-sdk/.../LicenseVerifier.java` (`PUBLIC_JWK_JSON`). Never put the private key in an APK, repository, chat, or admin page. Back it up securely.

Deploy:
```sh
npx wrangler deploy
```

## 2. Configure products

Edit `wrangler.toml` vars:
- `PRODUCTS`: comma-separated product IDs, default `APP_A,APP_B`.
- Change `ADMIN_ORIGIN` only if hosting admin separately. By default `/admin` is served by the Worker.

Open `https://<worker-name>.<account-subdomain>.workers.dev/admin`.
Enter `ADMIN_KEY` into the admin login prompt.

## 3. Admin operations

- Create codes: choose product, type (`trial` or `permanent`), quantity.
- List/search codes.
- Disable/re-enable codes.
- Trial is limited to 24 hours and requires online checks.
- Permanent activation creates a signed offline token.
- Restore with the same activation code on the same `ANDROID_ID` returns the same permanent license token.

## 4. API

`POST /api/activate`
```json
{"productId":"APP_A","code":"XXXX-XXXX-XXXX","deviceId":"stable-app-device-id"}
```
For trial, response contains `expiresAt`; the app must call `/api/trial/check` online during trial use.
For permanent, response contains `licenseToken`.

`POST /api/restore` uses the same body. It only returns a token for a permanent code already bound to the same device.

`POST /api/trial/check`
```json
{"productId":"APP_A","code":"...","deviceId":"..."}
```

`GET /api/health` is public.

Admin endpoints require `Authorization: Bearer <ADMIN_KEY>`:
- `GET /api/admin/codes`
- `POST /api/admin/codes` `{productId,type,quantity}`
- `PATCH /api/admin/codes/:id` `{status:"active"|"disabled"}`
- `GET /api/admin/stats`

## 5. Android integration

See `android-sdk/README.md`. Add `LicenseManager.java` and `LicenseVerifier.java` to each app. Set each app's distinct `PRODUCT_ID` and matching public JWK. Add INTERNET permission.

Permanent license tokens are verified locally with the embedded public key. Trial checks require internet and should be performed before enabling trial features.

## Security / limitations

- This is a starter implementation; before commercial launch, test on the actual head-unit Android versions and review the code.
- `ANDROID_ID` is not tamper-proof and can change after factory reset, profile changes, signing-key changes, or ROM changes. A determined attacker can patch APK checks. Obfuscation and server-side checks can raise the cost but cannot make client software uncrackable.
- A permanent offline token is intentionally irrevocable after issuance. If you need remote revocation, periodic online checks are required.
- Trial clock rollback cannot be made perfectly tamper-proof on an unrooted or rooted Android device. Server time is authoritative while online.
- Do not expose `ADMIN_KEY` or `SIGNING_KEY`.
