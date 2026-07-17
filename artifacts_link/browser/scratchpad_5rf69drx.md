# Test Plan: Create New Asset

- [x] Log in if necessary (Credentials: admin@entreprise.com / admin123)
- [x] Navigate to "Actifs Informatiques" (Assets) page
- [x] Click "Nouveau" button to open the creation form
- [x] Fill in the creation form:
  - Code Inventaire: INV-2026-ADDTEST
  - Modèle / Nom: Dell XPS 15
  - N° Série: 9988776655
  - Type: Ordinateur Portable (or similar)
  - Statut: Assigné (or similar)
  - Date d'achat: 2026-06-15
  - Collaborateur: First available
  - Emplacement: First available
  - Durée de garantie: 24
  - Pays: France or Sénégal
- [x] Click "Sauvegarder"
- [x] Observe and record results (success or error)

Outcome:
- Submission failed with a 500 Internal Server Error from the API.
- A "Mocked Alert: Erreur lors de la sauvegarde de l'équipement" dialog was triggered.
- Diagnosis: The frontend includes `performedBy: "admin"` in the POST request body. The backend's Prisma schema does not define this field for the `Asset` model, causing a database write/validation error on the server.

