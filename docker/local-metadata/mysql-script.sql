CREATE DATABASE openmetadata_db;
CREATE DATABASE airflow_db;
CREATE USER 'openmetadata_user'@'%' IDENTIFIED BY 'openmetadata_password';
CREATE USER 'airflow_user'@'%' IDENTIFIED BY 'airflow_pass';
GRANT ALL PRIVILEGES ON openmetadata_db.* TO 'openmetadata_user'@'%' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON airflow_db.* TO 'airflow_user'@'%' WITH GRANT OPTION;
commit;