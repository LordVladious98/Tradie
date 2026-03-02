# Security
- Access token: 15m, refresh token: 30d.
- Refresh tokens are hashed in DB and rotated on refresh.
- JWT bearer auth + OWNER/STAFF RBAC.
- Business tenancy enforced via `businessId` in all queries.
- Rate limiting applied to auth endpoints.
