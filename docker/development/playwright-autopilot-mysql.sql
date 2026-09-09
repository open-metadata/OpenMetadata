CREATE DATABASE autopilot_source;
CREATE DATABASE autopilot_secondary;
CREATE USER 'playwright'@'%' IDENTIFIED BY 'playwright-fixture-only';
GRANT SELECT, SHOW VIEW ON autopilot_source.* TO 'playwright'@'%';
GRANT SELECT, SHOW VIEW ON autopilot_secondary.* TO 'playwright'@'%';

CREATE TABLE autopilot_source.bot_entity (
  id INT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(255)
);
INSERT INTO autopilot_source.bot_entity VALUES
  (1, 'metadata-bot', 'metadata@example.com'),
  (2, 'profiler-bot', 'profiler@example.com');

CREATE TABLE autopilot_source.alert_entity (
  id INT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  enabled BOOLEAN NOT NULL
);
INSERT INTO autopilot_source.alert_entity VALUES
  (1, 'Daily quality report', TRUE),
  (2, 'Schema change', FALSE);

CREATE TABLE autopilot_secondary.chart_entity (
  id INT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
INSERT INTO autopilot_secondary.chart_entity VALUES
  (1, 'Revenue', '2026-01-01 00:00:00'),
  (2, 'Orders', '2026-01-02 00:00:00');
