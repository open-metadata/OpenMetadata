\set ON_ERROR_STOP on

CREATE ROLE om_reader LOGIN PASSWORD :'reader_password';
CREATE SCHEMA warehouse;
CREATE TABLE warehouse.events (id int, event_date date, payload jsonb)
    DISTRIBUTED BY (id) PARTITION BY RANGE (event_date);
CREATE TABLE warehouse.events_2026 PARTITION OF warehouse.events
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE warehouse.base (id int, amount numeric) DISTRIBUTED BY (id);
INSERT INTO warehouse.base VALUES (1, 10), (2, 20), (3, NULL);
ANALYZE warehouse.base;
COMMENT ON TABLE warehouse.base IS 'Cloudberry source table';
CREATE VIEW warehouse.plain_view AS SELECT id FROM warehouse.base;
CREATE MATERIALIZED VIEW warehouse.mat_view AS
    SELECT id, sum(amount) AS total FROM warehouse.base GROUP BY id;
CREATE EXTERNAL TABLE warehouse.ext_events (id int)
    LOCATION ('gpfdist://localhost:8081/events.csv') FORMAT 'CSV';
CREATE EXTENSION file_fdw;
CREATE SERVER om_files FOREIGN DATA WRAPPER file_fdw;
CREATE FOREIGN TABLE warehouse.foreign_events (id int) SERVER om_files
    OPTIONS (filename '/tmp/events.csv', format 'csv');
GRANT USAGE ON SCHEMA warehouse TO om_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA warehouse TO om_reader;
CREATE DATABASE om_cloudberry_second;
