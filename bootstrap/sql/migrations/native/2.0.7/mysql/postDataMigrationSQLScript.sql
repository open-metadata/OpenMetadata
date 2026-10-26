-- Apps no longer bring their own alerts. No shipped app listed any, so every alert an app
-- install created came from someone editing a definition: it is kept for an admin to review,
-- disabled and no longer tied to the app (relation 0 is CONTAINS). The list then leaves every
-- stored app, definition, version and change event.

-- event_subscription_entity: alerts an app install created
UPDATE event_subscription_entity
SET json = JSON_SET(json, '$.enabled', CAST('false' AS JSON))
WHERE id IN (SELECT toId FROM entity_relationship WHERE fromEntity = 'app' AND toEntity = 'eventsubscription' AND relation = 0);

DELETE FROM entity_relationship WHERE fromEntity = 'app' AND toEntity = 'eventsubscription' AND relation = 0;

UPDATE apps_marketplace SET json = JSON_REMOVE(json, '$.eventSubscriptions')
WHERE JSON_CONTAINS_PATH(json, 'one', '$.eventSubscriptions');

UPDATE installed_apps SET json = JSON_REMOVE(json, '$.eventSubscriptions')
WHERE JSON_CONTAINS_PATH(json, 'one', '$.eventSubscriptions');

UPDATE entity_extension SET json = JSON_REMOVE(json, '$.eventSubscriptions')
WHERE (extension LIKE 'app.version.%' OR extension LIKE 'appMarketPlaceDefinition.version.%')
  AND JSON_CONTAINS_PATH(json, 'one', '$.eventSubscriptions');

-- change_event: an event that holds its entity as an object
UPDATE change_event
SET json = JSON_REMOVE(json, '$.entity.eventSubscriptions')
WHERE entityType IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.entity')) = 'OBJECT'
    THEN JSON_CONTAINS_PATH(json, 'one', '$.entity.eventSubscriptions')
    ELSE 0 END = 1;

-- change_event: an event that holds its entity as a string of JSON
UPDATE change_event
SET json = JSON_SET(json, '$.entity',
  CAST(JSON_REMOVE(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')) AS JSON), '$.eventSubscriptions') AS CHAR))
WHERE entityType IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.entity')) = 'STRING'
    THEN CASE WHEN JSON_VALID(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')))
      THEN JSON_CONTAINS_PATH(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')) AS JSON), 'one', '$.eventSubscriptions')
      ELSE 0 END
    ELSE 0 END = 1;

-- successful_sent_change_events: an event that holds its entity as an object
UPDATE successful_sent_change_events
SET json = JSON_REMOVE(json, '$.entity.eventSubscriptions')
WHERE json ->> '$.entityType' IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.entity')) = 'OBJECT'
    THEN JSON_CONTAINS_PATH(json, 'one', '$.entity.eventSubscriptions')
    ELSE 0 END = 1;

-- successful_sent_change_events: an event that holds its entity as a string of JSON
UPDATE successful_sent_change_events
SET json = JSON_SET(json, '$.entity',
  CAST(JSON_REMOVE(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')) AS JSON), '$.eventSubscriptions') AS CHAR))
WHERE json ->> '$.entityType' IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.entity')) = 'STRING'
    THEN CASE WHEN JSON_VALID(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')))
      THEN JSON_CONTAINS_PATH(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')) AS JSON), 'one', '$.eventSubscriptions')
      ELSE 0 END
    ELSE 0 END = 1;

-- consumers_dlq: an event that holds its entity as an object
UPDATE consumers_dlq
SET json = JSON_REMOVE(json, '$.changeEvent.entity.eventSubscriptions')
WHERE json ->> '$.changeEvent.entityType' IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.changeEvent.entity')) = 'OBJECT'
    THEN JSON_CONTAINS_PATH(json, 'one', '$.changeEvent.entity.eventSubscriptions')
    ELSE 0 END = 1;

-- consumers_dlq: an event that holds its entity as a string of JSON
UPDATE consumers_dlq
SET json = JSON_SET(json, '$.changeEvent.entity',
  CAST(JSON_REMOVE(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.changeEvent.entity')) AS JSON), '$.eventSubscriptions') AS CHAR))
WHERE json ->> '$.changeEvent.entityType' IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.changeEvent.entity')) = 'STRING'
    THEN CASE WHEN JSON_VALID(JSON_UNQUOTE(JSON_EXTRACT(json, '$.changeEvent.entity')))
      THEN JSON_CONTAINS_PATH(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.changeEvent.entity')) AS JSON), 'one', '$.eventSubscriptions')
      ELSE 0 END
    ELSE 0 END = 1;

-- audit_log_event: an event that holds its entity as an object
UPDATE audit_log_event
SET event_json = CAST(JSON_REMOVE(CAST(event_json AS JSON), '$.entity.eventSubscriptions') AS CHAR)
WHERE entity_type IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN JSON_VALID(event_json)
    THEN CASE WHEN JSON_TYPE(JSON_EXTRACT(CAST(event_json AS JSON), '$.entity')) = 'OBJECT'
      THEN JSON_CONTAINS_PATH(CAST(event_json AS JSON), 'one', '$.entity.eventSubscriptions')
      ELSE 0 END
    ELSE 0 END = 1;

-- audit_log_event: an event that holds its entity as a string of JSON
UPDATE audit_log_event
SET event_json = CAST(JSON_SET(CAST(event_json AS JSON), '$.entity',
  CAST(JSON_REMOVE(CAST(JSON_UNQUOTE(JSON_EXTRACT(CAST(event_json AS JSON), '$.entity')) AS JSON), '$.eventSubscriptions') AS CHAR)) AS CHAR)
WHERE entity_type IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN JSON_VALID(event_json)
    THEN CASE WHEN JSON_TYPE(JSON_EXTRACT(CAST(event_json AS JSON), '$.entity')) = 'STRING'
      THEN CASE WHEN JSON_VALID(JSON_UNQUOTE(JSON_EXTRACT(CAST(event_json AS JSON), '$.entity')))
        THEN JSON_CONTAINS_PATH(CAST(JSON_UNQUOTE(JSON_EXTRACT(CAST(event_json AS JSON), '$.entity')) AS JSON), 'one', '$.eventSubscriptions')
        ELSE 0 END
      ELSE 0 END
    ELSE 0 END = 1;
