CREATE DATABASE openmetadata_db;
CREATE DATABASE airflow_db;
CREATE USER openmetadata_user WITH PASSWORD 'openmetadata_password';
CREATE USER airflow_user WITH PASSWORD 'airflow_pass';
ALTER DATABASE openmetadata_db OWNER TO openmetadata_user;
ALTER DATABASE airflow_db OWNER TO airflow_user;
ALTER USER airflow_user SET search_path = public;
commit;