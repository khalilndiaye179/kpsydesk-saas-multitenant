-- ==============================================================================
-- KPSyDesk IT ASSET MANAGEMENT - COMPREHENSIVE DATABASE SCHEMA
-- DBMS: MySQL / MariaDB
-- Respects ITSM, ITAM and CMDB best practices.
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ==============================================================================
-- 1. ORGANISATION ET ACCÈS (RBAC)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS Entities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  registration_number VARCHAR(100),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS Sites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  city VARCHAR(100),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (entity_id) REFERENCES Entities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_id INT NOT NULL,
  site_id INT NULL,
  name VARCHAR(150) NOT NULL,
  parent_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (entity_id) REFERENCES Entities(id) ON DELETE CASCADE,
  FOREIGN KEY (site_id) REFERENCES Sites(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_id) REFERENCES Departments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  department_id INT NULL,
  site_id INT NULL,
  role_id INT NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(30),
  password_hash VARCHAR(255) NOT NULL,
  job_title VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (department_id) REFERENCES Departments(id) ON DELETE SET NULL,
  FOREIGN KEY (site_id) REFERENCES Sites(id) ON DELETE SET NULL,
  FOREIGN KEY (role_id) REFERENCES Roles(id)
);

-- ==============================================================================
-- 2. LOGISTIQUE & FINANCES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS Suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_name VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(30),
  address TEXT,
  vat_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS PurchaseOrders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NOT NULL,
  order_number VARCHAR(100) UNIQUE NOT NULL,
  order_date DATE NOT NULL,
  total_amount DECIMAL(15,2),
  status ENUM('Brouillon', 'Commandé', 'Partiellement Livré', 'Livré', 'Annulé') DEFAULT 'Brouillon',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (supplier_id) REFERENCES Suppliers(id)
);

-- ==============================================================================
-- 3. ITAM & CMDB (GESTION DES ACTIFS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS AssetCategories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type ENUM('Matériel', 'Logiciel', 'Licence', 'Consommable', 'Réseau') NOT NULL,
  parent_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES AssetCategories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Manufacturers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  support_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS AssetModels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  manufacturer_id INT NOT NULL,
  category_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  model_number VARCHAR(100),
  specifications JSON COMMENT 'Stocke les specs techniques (CPU, RAM, type port, etc.)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (manufacturer_id) REFERENCES Manufacturers(id),
  FOREIGN KEY (category_id) REFERENCES AssetCategories(id)
);

CREATE TABLE IF NOT EXISTS Assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_id INT NOT NULL,
  site_id INT NULL COMMENT 'Localisation physique',
  purchase_order_id INT NULL,
  supplier_id INT NULL,
  inventory_code VARCHAR(100) UNIQUE NOT NULL,
  serial_number VARCHAR(150),
  mac_address VARCHAR(50),
  status ENUM('En Stock', 'Déployé', 'En Panne', 'En Maintenance', 'Perdu/Volé', 'Réformé', 'En Transit') DEFAULT 'En Stock',
  condition_state ENUM('Neuf', 'Bon', 'Usagé', 'Critique') DEFAULT 'Neuf',
  purchase_date DATE,
  purchase_price DECIMAL(15,2),
  warranty_end_date DATE,
  custom_fields JSON COMMENT 'Champs additionnels spécifiques selon la catégorie',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (model_id) REFERENCES AssetModels(id),
  FOREIGN KEY (site_id) REFERENCES Sites(id) ON DELETE SET NULL,
  FOREIGN KEY (purchase_order_id) REFERENCES PurchaseOrders(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES Suppliers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NOT NULL,
  contract_number VARCHAR(100) UNIQUE NOT NULL,
  type ENUM('Garantie Constructeur', 'Maintenance', 'Assurance', 'Location') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  cost DECIMAL(15,2),
  status ENUM('Actif', 'Expiré', 'Résilié') DEFAULT 'Actif',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (supplier_id) REFERENCES Suppliers(id)
);

CREATE TABLE IF NOT EXISTS AssetContracts (
  asset_id INT NOT NULL,
  contract_id INT NOT NULL,
  PRIMARY KEY (asset_id, contract_id),
  FOREIGN KEY (asset_id) REFERENCES Assets(id) ON DELETE CASCADE,
  FOREIGN KEY (contract_id) REFERENCES Contracts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CMDB_Dependencies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_asset_id INT NOT NULL,
  target_asset_id INT NOT NULL,
  dependency_type ENUM('Héberge', 'Connecté à', 'Dépend de', 'Alimente', 'Installé sur') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_asset_id) REFERENCES Assets(id) ON DELETE CASCADE,
  FOREIGN KEY (target_asset_id) REFERENCES Assets(id) ON DELETE CASCADE
);

-- ==============================================================================
-- 4. CYCLE DE VIE & TRAÇABILITÉ
-- ==============================================================================

CREATE TABLE IF NOT EXISTS AssetAssignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asset_id INT NOT NULL,
  user_id INT NULL COMMENT 'Null si assigné à un département entier',
  department_id INT NULL,
  assigned_by INT NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  returned_at DATETIME NULL,
  return_condition ENUM('Bon', 'Endommagé', 'Incomplet', 'Perdu') NULL,
  status ENUM('Actif', 'Terminé') DEFAULT 'Actif',
  notes TEXT,
  FOREIGN KEY (asset_id) REFERENCES Assets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES Departments(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by) REFERENCES Users(id)
);

CREATE TABLE IF NOT EXISTS AssetMovements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asset_id INT NOT NULL,
  performed_by INT NOT NULL,
  movement_type ENUM('Réception', 'Déploiement', 'Retour', 'Transfert', 'Changement Statut', 'Mise au Rebut') NOT NULL,
  from_location_id INT NULL,
  to_location_id INT NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  date DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (asset_id) REFERENCES Assets(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES Users(id),
  FOREIGN KEY (from_location_id) REFERENCES Sites(id) ON DELETE SET NULL,
  FOREIGN KEY (to_location_id) REFERENCES Sites(id) ON DELETE SET NULL
);

-- ==============================================================================
-- 5. ITSM (HELPDESK & MAINTENANCE)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS SLAs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  priority ENUM('Basse', 'Moyenne', 'Haute', 'Critique') NOT NULL,
  response_time_minutes INT NOT NULL,
  resolution_time_minutes INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  requester_id INT NOT NULL,
  asset_id INT NULL,
  technician_id INT NULL,
  sla_id INT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category ENUM('Incidents Matériel', 'Problème Logiciel', 'Réseau', 'Demande d\'accès', 'Demande Matériel') NOT NULL,
  priority ENUM('Basse', 'Moyenne', 'Haute', 'Critique') DEFAULT 'Moyenne',
  status ENUM('Nouveau', 'Ouvert', 'En attente', 'Résolu', 'Fermé') DEFAULT 'Nouveau',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  closed_at DATETIME NULL,
  FOREIGN KEY (requester_id) REFERENCES Users(id),
  FOREIGN KEY (asset_id) REFERENCES Assets(id) ON DELETE SET NULL,
  FOREIGN KEY (technician_id) REFERENCES Users(id) ON DELETE SET NULL,
  FOREIGN KEY (sla_id) REFERENCES SLAs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS TicketLogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  user_id INT NOT NULL,
  action_type ENUM('Commentaire', 'Changement Statut', 'Escalade', 'Réassignation') NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES Tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES Users(id)
);

CREATE TABLE IF NOT EXISTS Interventions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NULL,
  asset_id INT NOT NULL,
  technician_id INT NOT NULL,
  type ENUM('Préventive', 'Corrective') NOT NULL,
  description TEXT NOT NULL,
  parts_replaced TEXT,
  cost DECIMAL(10,2) DEFAULT 0.00,
  scheduled_at DATETIME,
  started_at DATETIME,
  completed_at DATETIME,
  status ENUM('Planifiée', 'En cours', 'Terminée', 'Annulée') DEFAULT 'Planifiée',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES Tickets(id) ON DELETE SET NULL,
  FOREIGN KEY (asset_id) REFERENCES Assets(id) ON DELETE CASCADE,
  FOREIGN KEY (technician_id) REFERENCES Users(id)
);

-- ==============================================================================
-- 6. SYSTÈME ET AUDIT
-- ==============================================================================

CREATE TABLE IF NOT EXISTS AuditLogs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id INT NOT NULL,
  action ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
  old_data JSON,
  new_data JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('Info', 'Alerte', 'Succès', 'Erreur') DEFAULT 'Info',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

SET FOREIGN_KEY_CHECKS = 1;
