-- Apps no longer create the alerts listed in their marketplace definition. An app's own code
-- still creates alerts it needs and links them to the app (relation 0 is CONTAINS); those run
-- the app's own consumer class. An alert linked to an app that is named in the app's
-- definition, or that uses the default alert consumer, came from a definition: it is disabled,
-- kept for an admin to review and no longer tied to the app. The list then leaves every stored
-- definition, definition version and definition change event.

-- event_subscription_entity: alerts an app install created from its definition
UPDATE event_subscription_entity
SET json = JSON_SET(json, '$.enabled', CAST('false' AS JSON))
WHERE id IN (SELECT id FROM (
  SELECT DISTINCT e.id FROM event_subscription_entity e
    JOIN entity_relationship r ON r.toId = e.id
      AND r.fromEntity = 'app' AND r.toEntity = 'eventsubscription' AND r.relation = 0
    LEFT JOIN installed_apps a ON a.id = r.fromId
    LEFT JOIN apps_marketplace m ON m.name = a.name
    WHERE JSON_EXTRACT(e.json, '$.className') IS NULL
      OR JSON_UNQUOTE(JSON_EXTRACT(e.json, '$.className')) = 'alert'
      OR JSON_UNQUOTE(JSON_EXTRACT(e.json, '$.className')) LIKE '%.AlertPublisher'
      OR JSON_CONTAINS(COALESCE(JSON_EXTRACT(m.json, '$.eventSubscriptions[*].name'), JSON_ARRAY()), JSON_QUOTE(e.name))
) planted);

DELETE FROM entity_relationship
WHERE fromEntity = 'app' AND toEntity = 'eventsubscription' AND relation = 0
  AND toId IN (SELECT id FROM (
  SELECT DISTINCT e.id FROM event_subscription_entity e
    JOIN entity_relationship r ON r.toId = e.id
      AND r.fromEntity = 'app' AND r.toEntity = 'eventsubscription' AND r.relation = 0
    LEFT JOIN installed_apps a ON a.id = r.fromId
    LEFT JOIN apps_marketplace m ON m.name = a.name
    WHERE JSON_EXTRACT(e.json, '$.className') IS NULL
      OR JSON_UNQUOTE(JSON_EXTRACT(e.json, '$.className')) = 'alert'
      OR JSON_UNQUOTE(JSON_EXTRACT(e.json, '$.className')) LIKE '%.AlertPublisher'
      OR JSON_CONTAINS(COALESCE(JSON_EXTRACT(m.json, '$.eventSubscriptions[*].name'), JSON_ARRAY()), JSON_QUOTE(e.name))
) planted);

UPDATE apps_marketplace SET json = JSON_REMOVE(json, '$.eventSubscriptions')
WHERE JSON_CONTAINS_PATH(json, 'one', '$.eventSubscriptions');

UPDATE entity_extension SET json = JSON_REMOVE(json, '$.eventSubscriptions')
WHERE extension LIKE 'appMarketPlaceDefinition.version.%'
  AND JSON_CONTAINS_PATH(json, 'one', '$.eventSubscriptions');

-- change_event: an event that holds its entity as an object
UPDATE change_event
SET json = JSON_REMOVE(json, '$.entity.eventSubscriptions')
WHERE entityType = 'appMarketPlaceDefinition'
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.entity')) = 'OBJECT'
    THEN JSON_CONTAINS_PATH(json, 'one', '$.entity.eventSubscriptions')
    ELSE 0 END = 1;

-- change_event: an event that holds its entity as a string of JSON
UPDATE change_event
SET json = JSON_SET(json, '$.entity',
  CAST(JSON_REMOVE(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')) AS JSON), '$.eventSubscriptions') AS CHAR))
WHERE entityType = 'appMarketPlaceDefinition'
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.entity')) = 'STRING'
    THEN CASE WHEN JSON_VALID(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')))
      THEN JSON_CONTAINS_PATH(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')) AS JSON), 'one', '$.eventSubscriptions')
      ELSE 0 END
    ELSE 0 END = 1;

-- successful_sent_change_events: an event that holds its entity as an object
UPDATE successful_sent_change_events
SET json = JSON_REMOVE(json, '$.entity.eventSubscriptions')
WHERE json ->> '$.entityType' = 'appMarketPlaceDefinition'
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.entity')) = 'OBJECT'
    THEN JSON_CONTAINS_PATH(json, 'one', '$.entity.eventSubscriptions')
    ELSE 0 END = 1;

-- successful_sent_change_events: an event that holds its entity as a string of JSON
UPDATE successful_sent_change_events
SET json = JSON_SET(json, '$.entity',
  CAST(JSON_REMOVE(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')) AS JSON), '$.eventSubscriptions') AS CHAR))
WHERE json ->> '$.entityType' = 'appMarketPlaceDefinition'
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.entity')) = 'STRING'
    THEN CASE WHEN JSON_VALID(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')))
      THEN JSON_CONTAINS_PATH(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entity')) AS JSON), 'one', '$.eventSubscriptions')
      ELSE 0 END
    ELSE 0 END = 1;

-- consumers_dlq: an event that holds its entity as an object
UPDATE consumers_dlq
SET json = JSON_REMOVE(json, '$.changeEvent.entity.eventSubscriptions')
WHERE json ->> '$.changeEvent.entityType' = 'appMarketPlaceDefinition'
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.changeEvent.entity')) = 'OBJECT'
    THEN JSON_CONTAINS_PATH(json, 'one', '$.changeEvent.entity.eventSubscriptions')
    ELSE 0 END = 1;

-- consumers_dlq: an event that holds its entity as a string of JSON
UPDATE consumers_dlq
SET json = JSON_SET(json, '$.changeEvent.entity',
  CAST(JSON_REMOVE(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.changeEvent.entity')) AS JSON), '$.eventSubscriptions') AS CHAR))
WHERE json ->> '$.changeEvent.entityType' = 'appMarketPlaceDefinition'
  AND CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.changeEvent.entity')) = 'STRING'
    THEN CASE WHEN JSON_VALID(JSON_UNQUOTE(JSON_EXTRACT(json, '$.changeEvent.entity')))
      THEN JSON_CONTAINS_PATH(CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.changeEvent.entity')) AS JSON), 'one', '$.eventSubscriptions')
      ELSE 0 END
    ELSE 0 END = 1;

-- audit_log_event: an event that holds its entity as an object
UPDATE audit_log_event
SET event_json = CAST(JSON_REMOVE(CAST(event_json AS JSON), '$.entity.eventSubscriptions') AS CHAR)
WHERE entity_type = 'appMarketPlaceDefinition'
  AND CASE WHEN JSON_VALID(event_json)
    THEN CASE WHEN JSON_TYPE(JSON_EXTRACT(CAST(event_json AS JSON), '$.entity')) = 'OBJECT'
      THEN JSON_CONTAINS_PATH(CAST(event_json AS JSON), 'one', '$.entity.eventSubscriptions')
      ELSE 0 END
    ELSE 0 END = 1;

-- audit_log_event: an event that holds its entity as a string of JSON
UPDATE audit_log_event
SET event_json = CAST(JSON_SET(CAST(event_json AS JSON), '$.entity',
  CAST(JSON_REMOVE(CAST(JSON_UNQUOTE(JSON_EXTRACT(CAST(event_json AS JSON), '$.entity')) AS JSON), '$.eventSubscriptions') AS CHAR)) AS CHAR)
WHERE entity_type = 'appMarketPlaceDefinition'
  AND CASE WHEN JSON_VALID(event_json)
    THEN CASE WHEN JSON_TYPE(JSON_EXTRACT(CAST(event_json AS JSON), '$.entity')) = 'STRING'
      THEN CASE WHEN JSON_VALID(JSON_UNQUOTE(JSON_EXTRACT(CAST(event_json AS JSON), '$.entity')))
        THEN JSON_CONTAINS_PATH(CAST(JSON_UNQUOTE(JSON_EXTRACT(CAST(event_json AS JSON), '$.entity')) AS JSON), 'one', '$.eventSubscriptions')
        ELSE 0 END
      ELSE 0 END
    ELSE 0 END = 1;

-- An app's alert list is filled from the app->alert relationship on every read and is no longer
-- stored. The copy in the app JSON, and any alert written into it by hand, leaves stored apps and
-- app versions; the relationship rows that record the app's own alerts stay.
UPDATE installed_apps SET json = JSON_REMOVE(json, '$.eventSubscriptions')
WHERE JSON_CONTAINS_PATH(json, 'one', '$.eventSubscriptions');

UPDATE entity_extension SET json = JSON_REMOVE(json, '$.eventSubscriptions')
WHERE extension LIKE 'app.version.%'
  AND JSON_CONTAINS_PATH(json, 'one', '$.eventSubscriptions');
