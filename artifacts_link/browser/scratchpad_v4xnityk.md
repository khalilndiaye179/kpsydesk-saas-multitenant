# QA Audit - Asset Creation Fix Verification

## Checklist
- [x] List open browser pages to find page_id <!-- id: 0 -->
- [x] Navigate to http://localhost:3005 and check login state <!-- id: 1 -->
- [x] Log in with admin credentials if not already logged in <!-- id: 2 -->
- [x] Navigate to "Actifs Informatiques" <!-- id: 3 -->
- [x] Click the "Nouveau" button to open the form <!-- id: 4 -->
- [x] Fill the form fields:
  - Code Inventaire: `INV-2026-TEST`
  - Modèle / Nom: `Dell XPS`
  - N° Série: `345009876`
  - Date d'acquisition: `15/04/2026` or `04/15/2026`
  - Garantie (mois): `24` <!-- id: 5 -->
- [x] Click "Enregistrer" <!-- id: 6 -->
- [x] Confirm no error alert occurs and the modal closes successfully <!-- id: 7 -->

## Notes
- Current Page ID: DFC8AAEAF84F11EF75BE5A79C7449110
- Status: Failed. Form submission triggers an Internal Server Error (500) from the backend API `POST /api/assets`.
- Captured alert message: "Erreur lors de la sauvegarde de l'équipement".
- Backend response body: `{"statusCode":500,"message":"Internal server error"}`.
