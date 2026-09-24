# Admin-only reporting (local demo)

Admin: `admin` / `admin123` (change before deployment). Only admin can submit Quick Reports, upload geo-tagged photos, sync offline reports, and delete any report. Public and officer accounts can view maps, routes, analysis and published reports. Existing public offline drafts will not sync; clear them locally.

## Why server authorization matters
Buttons are hidden for non-admin users, but the backend also checks the authenticated role on POST /api/photos, POST /api/photos/batch and DELETE /api/photos/:id. Browser-supplied userId/role cannot elevate permissions. Login tokens are random server-side sessions and are invalidated on restart.

## Important limitations
This is a local demonstration with plaintext sample passwords and JSON file storage, not production authentication. For public deployment, use a real identity provider, password hashing, HTTPS, persistent session store, audit logs, rate limits, image moderation, verified administrator accounts, and backups. Admin reports can still be mistaken or malicious: review evidence before publication. Cached reports may remain on previously visited devices until refreshed.
