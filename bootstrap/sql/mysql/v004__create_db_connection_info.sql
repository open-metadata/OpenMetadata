--
-- Change timestamp column precision to include microseconds
--
ALTER TABLE change_event
DROP INDEX dateTime,
DROP COLUMN dateTime,
ADD COLUMN dateTime TIMESTAMP(6) GENERATED ALWAYS AS (STR_TO_DATE(json ->> '$.dateTime', '%Y-%m-%dT%T.%fZ')) NOT NULL AFTER username,
ADD INDEX (dateTime);
