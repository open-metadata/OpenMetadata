-- Create tables for tracking server migrations
-- This migration runs before all other migrations to ensure migration tracking tables exist

CREATE TABLE IF NOT EXISTS SERVER_CHANGE_LOG (
    installed_rank BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    version VARCHAR(256) NOT NULL,
    migrationFileName VARCHAR(256) NOT NULL,
    checksum VARCHAR(256) NOT NULL,
    installed_on TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    metrics JSON,
    PRIMARY KEY (version),
    UNIQUE KEY installed_rank (installed_rank)
);

CREATE TABLE IF NOT EXISTS SERVER_MIGRATION_SQL_LOGS (
    version VARCHAR(256) NOT NULL,
    sqlStatement VARCHAR(10000) NOT NULL,
    checksum VARCHAR(256) PRIMARY KEY,
    executedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);