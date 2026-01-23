-- MySQL initialization script for distributed test environment

-- Create the OpenMetadata database
CREATE DATABASE IF NOT EXISTS openmetadata_db;

-- Create the OpenMetadata user
CREATE USER IF NOT EXISTS 'openmetadata_user'@'%' IDENTIFIED BY 'openmetadata_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON openmetadata_db.* TO 'openmetadata_user'@'%';
GRANT ALL PRIVILEGES ON *.* TO 'openmetadata_user'@'%';

FLUSH PRIVILEGES;
