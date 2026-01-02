-- Create Learning Resource Entity Table
CREATE TABLE IF NOT EXISTS learning_resource_entity (
  id varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.id'))) STORED NOT NULL,
  name varchar(3072) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.fullyQualifiedName'))) VIRTUAL,
  fqnHash varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  json json NOT NULL,
  updatedAt bigint UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.updatedAt'))) VIRTUAL NOT NULL,
  updatedBy varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.updatedBy'))) VIRTUAL NOT NULL,
  deleted TINYINT(1) GENERATED ALWAYS AS (IF(json_extract(json,'$.deleted') = TRUE, 1, 0)) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY fqnHash (fqnHash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
