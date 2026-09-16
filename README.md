FastSMS Worker + D1 starter.

This package is designed for a Cloudflare Worker connected to the existing FastSMS D1 database.

IMPORTANT:
1. Open wrangler.toml.
2. Replace PASTE_YOUR_D1_DATABASE_ID_HERE with the ID of your existing fastsms-db database.
3. The Worker provides /api/register, /api/login, /api/me and /api/logout.
4. Run schema.sql once against fastsms-db before testing registration/login.

Security note: this starter uses SHA-256 for passwords and should be upgraded to a memory-hard password hashing scheme before production use.
