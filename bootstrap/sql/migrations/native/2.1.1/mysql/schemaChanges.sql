UPDATE dbservice_entity
SET json = JSON_SET(json, '$.connection.config.scheme', 'oracle+oracledb')
WHERE serviceType = 'Oracle'
  AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.connection.config.scheme')) = 'oracle+cx_oracle';
