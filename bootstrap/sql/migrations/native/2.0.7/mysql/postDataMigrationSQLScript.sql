-- A user's authentication mechanism (a password hash or a bot token) leaves every stored
-- change event and user version; new ones no longer carry it.

-- change_event: an event that holds its entity as an object
UPDATE change_event
SET json = JSON_REMOVE(json, '$.entity.authenticationMechanism')
WHERE entityType IN ('user')
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.entity')) = 'OBJECT'
    THEN JSON_CONTAINS_PATH(json, 'one', '$.entity.authenticationMechanism')
    ELSE 0 END = 1;

-- change_event: an event that holds its entity as a string of JSON
UPDATE change_event
SET json = JSON_SET(json, '$.entity',
  CAST(JSON_REMOVE(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')) AS JSON), '$.authenticationMechanism') AS CHAR))
WHERE entityType IN ('user')
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.entity')) = 'STRING'
    THEN CASE WHEN JSON_VALID(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')))
      THEN JSON_CONTAINS_PATH(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')) AS JSON), 'one', '$.authenticationMechanism')
      ELSE 0 END
    ELSE 0 END = 1;

-- successful_sent_change_events: an event that holds its entity as an object
UPDATE successful_sent_change_events
SET json = JSON_REMOVE(json, '$.entity.authenticationMechanism')
WHERE json ->> '$.entityType' IN ('user')
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.entity')) = 'OBJECT'
    THEN JSON_CONTAINS_PATH(json, 'one', '$.entity.authenticationMechanism')
    ELSE 0 END = 1;

-- successful_sent_change_events: an event that holds its entity as a string of JSON
UPDATE successful_sent_change_events
SET json = JSON_SET(json, '$.entity',
  CAST(JSON_REMOVE(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')) AS JSON), '$.authenticationMechanism') AS CHAR))
WHERE json ->> '$.entityType' IN ('user')
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.entity')) = 'STRING'
    THEN CASE WHEN JSON_VALID(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')))
      THEN JSON_CONTAINS_PATH(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')) AS JSON), 'one', '$.authenticationMechanism')
      ELSE 0 END
    ELSE 0 END = 1;

-- consumers_dlq: an event that holds its entity as an object
UPDATE consumers_dlq
SET json = JSON_REMOVE(json, '$.changeEvent.entity.authenticationMechanism')
WHERE json ->> '$.changeEvent.entityType' IN ('user')
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.changeEvent.entity')) = 'OBJECT'
    THEN JSON_CONTAINS_PATH(json, 'one', '$.changeEvent.entity.authenticationMechanism')
    ELSE 0 END = 1;

-- consumers_dlq: an event that holds its entity as a string of JSON
UPDATE consumers_dlq
SET json = JSON_SET(json, '$.changeEvent.entity',
  CAST(JSON_REMOVE(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.changeEvent.entity')) AS JSON), '$.authenticationMechanism') AS CHAR))
WHERE json ->> '$.changeEvent.entityType' IN ('user')
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.changeEvent.entity')) = 'STRING'
    THEN CASE WHEN JSON_VALID(JSON_UNQUOTE(JSON_EXTRACT(json, '$.changeEvent.entity')))
      THEN JSON_CONTAINS_PATH(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.changeEvent.entity')) AS JSON), 'one', '$.authenticationMechanism')
      ELSE 0 END
    ELSE 0 END = 1;

-- audit_log_event: an event that holds its entity as an object
UPDATE audit_log_event
SET event_json = CAST(JSON_REMOVE(CAST(event_json AS JSON), '$.entity.authenticationMechanism') AS CHAR)
WHERE entity_type IN ('user')
  AND CASE WHEN JSON_VALID(event_json)
    THEN CASE WHEN JSON_TYPE(JSON_EXTRACT(CAST(event_json AS JSON), '$.entity')) = 'OBJECT'
      THEN JSON_CONTAINS_PATH(CAST(event_json AS JSON), 'one', '$.entity.authenticationMechanism')
      ELSE 0 END
    ELSE 0 END = 1;

-- audit_log_event: an event that holds its entity as a string of JSON
UPDATE audit_log_event
SET event_json = CAST(JSON_SET(CAST(event_json AS JSON), '$.entity',
  CAST(JSON_REMOVE(CAST(JSON_UNQUOTE(JSON_EXTRACT(CAST(event_json AS JSON), '$.entity')) AS JSON), '$.authenticationMechanism') AS CHAR)) AS CHAR)
WHERE entity_type IN ('user')
  AND CASE WHEN JSON_VALID(event_json)
    THEN CASE WHEN JSON_TYPE(JSON_EXTRACT(CAST(event_json AS JSON), '$.entity')) = 'STRING'
      THEN CASE WHEN JSON_VALID(JSON_UNQUOTE(JSON_EXTRACT(CAST(event_json AS JSON), '$.entity')))
        THEN JSON_CONTAINS_PATH(CAST(JSON_UNQUOTE(JSON_EXTRACT(CAST(event_json AS JSON), '$.entity')) AS JSON), 'one', '$.authenticationMechanism')
        ELSE 0 END
      ELSE 0 END
    ELSE 0 END = 1;

-- entity_extension: stored user versions
UPDATE entity_extension SET json = JSON_REMOVE(json, '$.authenticationMechanism')
WHERE extension LIKE 'user.version.%'
  AND JSON_CONTAINS_PATH(json, 'one', '$.authenticationMechanism');
