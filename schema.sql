-- SQL para criação do banco de dados para instalação em VPS
CREATE DATABASE IF NOT EXISTS pix_manager;
USE pix_manager;

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
    uid VARCHAR(128) PRIMARY KEY,
    displayName VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- Para Auth Manual em VPS
    role ENUM('admin', 'viewer') DEFAULT 'viewer',
    allowed_identifiers TEXT, -- JSON array de strings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de Configurações da Empresa
CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY DEFAULT 1,
    company_name VARCHAR(255),
    cnpj VARCHAR(20),
    pix_key VARCHAR(255),
    sicoob_client_id VARCHAR(255),
    sicoob_client_secret TEXT,
    sicoob_cert TEXT,
    sicoob_key TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT single_row CHECK (id = 1)
);

-- Tabela de Identificadores (Globais)
CREATE TABLE IF NOT EXISTS identifiers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(128) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Transações
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id VARCHAR(255) UNIQUE,
    payer_name VARCHAR(255),
    document VARCHAR(20),
    amount DECIMAL(15,2),
    identifier VARCHAR(128),
    status ENUM('pending', 'confirmed') DEFAULT 'pending',
    pix_data TEXT, -- Conteúdo do Copy/Paste
    qr_code TEXT, -- Link do QR Code ou Base64
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de Logs do Sistema
CREATE TABLE IF NOT EXISTS logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(255),
    details TEXT,
    user_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir usuário Admin padrão (Senha: admin123)
-- Nota: O hash deve ser gerado pelo bcrypt no servidor
INSERT INTO users (uid, displayName, email, role) 
VALUES ('admin-vps', 'Administrador VPS', 'admin@admin.com', 'admin');
