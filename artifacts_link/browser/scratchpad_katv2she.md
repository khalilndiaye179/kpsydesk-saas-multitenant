# Scratchpad - General Modules Audit

## Progress Checklist
- [x] Log in (If not already logged in)
- [x] 1. Dashboard: check if charts render without errors.
- [x] 2. Actifs Informatiques: click "Nouveau", fill dummy asset & save, edit asset & save, delete asset.
- [x] 3. Mouvements d'actifs: add a movement, save.
- [x] 4. Tickets & Support: add a ticket, save.
- [x] 5. Collaborateurs: add a user, save.

## Findings / Bugs Identified
- Initial check: Dashboard shows API errors in console (500 on api/assets, 500 on api/tickets, 404 on api/movements).
- Actifs Informatiques:
  - Creating new asset failed with API 500 (POST /api/assets)
  - Editing asset failed with API 404 (PUT /api/assets/<id>) because UI falls back to mock assets which don't exist in backend.
  - Deleting asset failed with API 404 (DELETE /api/assets/<id>?performedBy=admin) due to same mock fallback reason.
- Mouvements d'actifs:
  - There is no manual option to create movements (they are created automatically on asset assignment/updates).
  - API call GET /api/movements fails with 404.
- Tickets & Support:
  - Creating a new ticket failed with API 500 (POST /api/tickets).
- Collaborateurs:
  - Creating a new user failed with API 500 (POST /api/users).

