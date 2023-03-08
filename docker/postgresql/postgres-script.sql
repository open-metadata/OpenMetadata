CREATE DATABASE openmetadata_db;
CREATE DATABASE airflow_db;
CREATE USER openmetadata_user WITH PASSWORD 'openmetadata_password';
CREATE USER airflow_user WITH PASSWORD 'airflow_pass';
GRANT ALL PRIVILEGES ON DATABASE openmetadata_db TO openmetadata_user;
GRANT ALL PRIVILEGES ON DATABASE airflow_db TO airflow_user;
ALTER USER airflow_user SET search_path = public;
commit;