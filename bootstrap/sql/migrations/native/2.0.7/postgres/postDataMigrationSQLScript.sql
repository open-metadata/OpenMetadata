-- A user's authentication mechanism (a password hash or a bot token) leaves every stored
-- change event and user version; new ones no longer carry it.

-- change_event: an event that holds its entity as an object
UPDATE change_event
SET json = json #- '{entity,authenticationMechanism}'
WHERE entityType IN ('user')
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'object'
    THEN json -> 'entity' -> 'authenticationMechanism' IS NOT NULL
    ELSE false END;

-- change_event: an event that holds its entity as a string of JSON
UPDATE change_event
SET json = jsonb_set(json, '{entity}',
  to_jsonb(((json ->> 'entity')::jsonb - 'authenticationMechanism')::text))
WHERE entityType IN ('user')
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'string'
    THEN CASE WHEN (json ->> 'entity') LIKE '{%'
      THEN (json ->> 'entity')::jsonb -> 'authenticationMechanism' IS NOT NULL
      ELSE false END
    ELSE false END;

-- successful_sent_change_events: an event that holds its entity as an object
UPDATE successful_sent_change_events
SET json = json #- '{entity,authenticationMechanism}'
WHERE json ->> 'entityType' IN ('user')
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'object'
    THEN json -> 'entity' -> 'authenticationMechanism' IS NOT NULL
    ELSE false END;

-- successful_sent_change_events: an event that holds its entity as a string of JSON
UPDATE successful_sent_change_events
SET json = jsonb_set(json, '{entity}',
  to_jsonb(((json ->> 'entity')::jsonb - 'authenticationMechanism')::text))
WHERE json ->> 'entityType' IN ('user')
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'string'
    THEN CASE WHEN (json ->> 'entity') LIKE '{%'
      THEN (json ->> 'entity')::jsonb -> 'authenticationMechanism' IS NOT NULL
      ELSE false END
    ELSE false END;

-- consumers_dlq: an event that holds its entity as an object
UPDATE consumers_dlq
SET json = json #- '{changeEvent,entity,authenticationMechanism}'
WHERE json -> 'changeEvent' ->> 'entityType' IN ('user')
  AND CASE WHEN jsonb_typeof(json -> 'changeEvent' -> 'entity') = 'object'
    THEN json -> 'changeEvent' -> 'entity' -> 'authenticationMechanism' IS NOT NULL
    ELSE false END;

-- consumers_dlq: an event that holds its entity as a string of JSON
UPDATE consumers_dlq
SET json = jsonb_set(json, '{changeEvent,entity}',
  to_jsonb(((json -> 'changeEvent' ->> 'entity')::jsonb - 'authenticationMechanism')::text))
WHERE json -> 'changeEvent' ->> 'entityType' IN ('user')
  AND CASE WHEN jsonb_typeof(json -> 'changeEvent' -> 'entity') = 'string'
    THEN CASE WHEN (json -> 'changeEvent' ->> 'entity') LIKE '{%'
      THEN (json -> 'changeEvent' ->> 'entity')::jsonb -> 'authenticationMechanism' IS NOT NULL
      ELSE false END
    ELSE false END;

-- audit_log_event: an event that holds its entity as an object
UPDATE audit_log_event
SET event_json = (event_json::jsonb #- '{entity,authenticationMechanism}')::text
WHERE entity_type IN ('user')
  AND CASE WHEN event_json LIKE '{%'
    THEN CASE WHEN jsonb_typeof(event_json::jsonb -> 'entity') = 'object'
      THEN event_json::jsonb -> 'entity' -> 'authenticationMechanism' IS NOT NULL
      ELSE false END
    ELSE false END;

-- audit_log_event: an event that holds its entity as a string of JSON
UPDATE audit_log_event
SET event_json = (jsonb_set(event_json::jsonb, '{entity}',
  to_jsonb(((event_json::jsonb ->> 'entity')::jsonb - 'authenticationMechanism')::text)))::text
WHERE entity_type IN ('user')
  AND CASE WHEN event_json LIKE '{%'
    THEN CASE WHEN jsonb_typeof(event_json::jsonb -> 'entity') = 'string'
      THEN CASE WHEN (event_json::jsonb ->> 'entity') LIKE '{%'
        THEN (event_json::jsonb ->> 'entity')::jsonb -> 'authenticationMechanism' IS NOT NULL
        ELSE false END
      ELSE false END
    ELSE false END;

-- entity_extension: stored user versions
UPDATE entity_extension SET json = json - 'authenticationMechanism'
WHERE extension LIKE 'user.version.%'
  AND json -> 'authenticationMechanism' IS NOT NULL;
