# KPSyDesk Asset Tool - Guide d'Utilisation Complet

Bienvenue dans le guide officiel de **KPSyDesk Asset Tool**, la solution professionnelle pour la gestion de votre parc informatique. Ce guide a été conçu de manière simple et visuelle pour accompagner tous les utilisateurs, même les moins expérimentés en informatique, pas à pas.

---

## 1. Démarrage et Connexion

Pour lancer l'application, double-cliquez sur le raccourci **KPSyDesk Asset Tool** sur votre bureau. L'application s'ouvre sur une interface sécurisée.

**Étapes de connexion :**
1. Saisissez votre **Identifiant** (Nom d'utilisateur).
2. Saisissez votre **Mot de passe**.
3. Si vous avez configuré la double vérification (MFA), le système vous demandera un code.
4. Cliquez sur **Se Connecter**.

*Astuce : Si votre licence d'essai est sur le point d'expirer, un message d'alerte s'affichera au démarrage pour vous rappeler de la renouveler.*

---

## 2. Le Tableau de Bord (Dashboard)

Dès votre connexion, vous arrivez sur le **Tableau de Bord**. C'est votre centre de contrôle.

![Tableau de Bord KPSyDesk](file:///C:/Users/ibrahima.ndiaye/.gemini/antigravity/brain/0c3410ab-8c44-49e5-b989-19a1f384f44a/dashboard_kpsydesk_1779393542107.png)

**Que voyez-vous ?**
- **Indicateurs Clés (En haut) :** Vous y trouvez le nombre total d'équipements, le nombre de tickets d'assistance (Helpdesk) en cours, et le nombre de licences logicielles arrivant bientôt à expiration.
- **Graphiques :** Des diagrammes circulaires vous montrent la répartition de votre matériel (ex: combien d'ordinateurs portables vs fixes) et l'état des tickets.
- **Menu Latéral (À gauche) :** C'est grâce à ce menu que vous pouvez naviguer d'un module à l'autre (Inventaire, Helpdesk, Paramètres, etc.).

---

## 3. Module Inventaire (Matériel)

Ce module vous permet de lister tout le matériel informatique de l'entreprise (ordinateurs, imprimantes, routeurs).

![Inventaire KPSyDesk](file:///C:/Users/ibrahima.ndiaye/.gemini/antigravity/brain/0c3410ab-8c44-49e5-b989-19a1f384f44a/inventory_kpsydesk_1779393555217.png)

**Comment ajouter un nouvel équipement ?**
1. Cliquez sur le bouton bleu **+ Nouvel Équipement**.
2. Une fenêtre s'ouvre : remplissez les champs obligatoires comme le *Nom* de l'appareil, sa *Marque*, son *Modèle* et son *Numéro de série*.
3. Choisissez son **Statut** : Actif (En service), En panne, En stock, ou Réformé (Mis au rebut/vendu).
4. Cliquez sur **Enregistrer**. L'équipement apparaît instantanément dans la liste !

*Fonctionnalité avancée :* Vous pouvez cliquer sur l'icône "Imprimer" à côté d'un équipement pour générer sa fiche PDF incluant un code QR scannable !

---

## 4. Module Consommables & Stock Avancé

Le matériel "consommable" correspond aux éléments qui s'usent ou se vident (cartouches d'encre, ramettes de papier, clés USB).

**Gestion des Consommables :**
1. Allez dans le module **Consommables**.
2. Cliquez sur **Ajouter Consommable**.
3. Renseignez la description (ex: *Cartouche d'encre HP Noir*), la quantité actuelle en stock, et un **Seuil d'alerte**.
4. *À quoi sert le seuil d'alerte ?* Si vous définissez le seuil à "5", l'application vous avertira automatiquement (avec une couleur rouge) dès qu'il ne restera plus que 5 cartouches, vous indiquant qu'il est temps d'en commander.

---

## 5. Module Licences (Logiciels)

Ne perdez plus la trace de vos abonnements logiciels (Antivirus, Microsoft Office, logiciels de montage, etc.) !

![Licences KPSyDesk](file:///C:/Users/ibrahima.ndiaye/.gemini/antigravity/brain/0c3410ab-8c44-49e5-b989-19a1f384f44a/license_kpsydesk_1779393583085.png)

**Comment gérer vos Licences ?**
1. Accédez au module **Licences**.
2. Cliquez sur **Nouvelle Licence** et saisissez le nom du logiciel et sa Clé d'activation.
3. Renseignez le nombre de "Postes autorisés" (ex: 10 PC) et le nombre de "Postes utilisés" (ex: 8 PC).
4. Indiquez la **Date d'expiration**. 
L'application calculera automatiquement s'il vous reste des postes libres, et la ligne deviendra **rouge** 30 jours avant l'expiration pour que vous ne soyez jamais pris de court !

---

## 6. Module Helpdesk (Tickets d'Assistance)

C'est ici que les employés peuvent signaler une panne, et que le service informatique peut suivre la réparation.

![Helpdesk KPSyDesk](file:///C:/Users/ibrahima.ndiaye/.gemini/antigravity/brain/0c3410ab-8c44-49e5-b989-19a1f384f44a/helpdesk_kpsydesk_1779393570130.png)

**Comment créer un ticket de panne ?**
1. Allez dans **Helpdesk** > **Nouveau Ticket**.
2. Sélectionnez l'équipement défectueux dans la liste déroulante.
3. Écrivez un titre clair (ex: *L'imprimante bourre le papier*) et décrivez le problème.
4. Choisissez la priorité (Basse, Normale, Haute, Critique).

**Suivi :** Les techniciens peuvent changer le statut du ticket (Nouveau -> En Cours -> Résolu). Une fois résolu, tout est tracé dans l'historique !

---

## 7. Module Ventes, Achats & Contrats

KPSyDesk ne fait pas qu'inventorier, il suit aussi l'aspect financier.

- **Ventes (Réformes) :** Un vieil ordinateur est vendu à un employé ? Allez dans "Ventes" pour enregistrer la transaction (date, prix, acheteur). L'appareil passe automatiquement en statut "Réformé".
- **Achats :** Vous pouvez y référencer tous vos fournisseurs (Nom, Contact, Email) et consigner vos Bons de Commande.
- **Contrats & Maintenance :** Sauvegardez ici vos contrats avec vos prestataires externes (ex: contrat de nettoyage, garantie serveurs) pour toujours avoir les dates d'échéance sous les yeux.

---

## 8. Paramètres et Administration (Pour les Managers)

Seuls les utilisateurs avec le rôle "Admin" ont accès aux réglages avancés.

- **Gestion des Comptes :** Créez des comptes pour vos collègues. Vous pouvez leur donner un accès total (*Admin*), un accès restreint aux pannes (*User*), ou un accès lecture seule (*RH* ou *Finance*).
- **Sauvegardes :** Dans la section Sauvegarde, vous pouvez configurer l'application pour qu'elle crée une sauvegarde automatique de vos données tous les jours ou toutes les semaines vers un disque dur externe ou une clé USB de votre choix.

---

### Conclusion
KPSyDesk Asset Tool est pensé pour vous faire gagner un temps précieux. La règle d'or est simple : **tout équipement qui entre ou sort de l'entreprise doit être enregistré.** Vous bénéficierez ainsi d'une visibilité parfaite sur votre budget informatique et limiterez les pertes ou les oublis.

*En cas de problème technique ou si votre licence d'utilisation est arrivée à terme, veuillez contacter Ibrahima NDIAYE au +221 77 803 47 56 ou +221 76 261 39 39 | Email : neguinho.ndiaye@gmail.com*
