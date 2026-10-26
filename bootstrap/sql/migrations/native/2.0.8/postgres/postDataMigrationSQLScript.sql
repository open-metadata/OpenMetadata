-- Apps no longer create the alerts listed in their marketplace definition. An app's own code
-- still creates alerts it needs and links them to the app (relation 0 is CONTAINS); those run
-- the app's own consumer class. An alert linked to an app that is named in the app's
-- definition, or that uses the default alert consumer, came from a definition: it is disabled,
-- kept for an admin to review and no longer tied to the app. The list then leaves every stored
-- definition, definition version and definition change event.

-- event_subscription_entity: alerts an app install created from its definition
UPDATE event_subscription_entity
SET json = jsonb_set(json, '{enabled}', 'false'::jsonb)
WHERE id IN (SELECT id FROM (
  SELECT DISTINCT e.id FROM event_subscription_entity e
    JOIN entity_relationship r ON r.toId = e.id
      AND r.fromEntity = 'app' AND r.toEntity = 'eventsubscription' AND r.relation = 0
    LEFT JOIN installed_apps a ON a.id = r.fromId
    LEFT JOIN apps_marketplace m ON m.name = a.name
    WHERE e.json ->> 'className' IS NULL
      OR e.json ->> 'className' = 'alert'
      OR e.json ->> 'className' LIKE '%.AlertPublisher'
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(m.json -> 'eventSubscriptions') = 'array'
          THEN m.json -> 'eventSubscriptions' ELSE '[]'::jsonb END) s
        WHERE s ->> 'name' = e.name)
) planted);

DELETE FROM entity_relationship
WHERE fromEntity = 'app' AND toEntity = 'eventsubscription' AND relation = 0
  AND toId IN (SELECT id FROM (
  SELECT DISTINCT e.id FROM event_subscription_entity e
    JOIN entity_relationship r ON r.toId = e.id
      AND r.fromEntity = 'app' AND r.toEntity = 'eventsubscription' AND r.relation = 0
    LEFT JOIN installed_apps a ON a.id = r.fromId
    LEFT JOIN apps_marketplace m ON m.name = a.name
    WHERE e.json ->> 'className' IS NULL
      OR e.json ->> 'className' = 'alert'
      OR e.json ->> 'className' LIKE '%.AlertPublisher'
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(m.json -> 'eventSubscriptions') = 'array'
          THEN m.json -> 'eventSubscriptions' ELSE '[]'::jsonb END) s
        WHERE s ->> 'name' = e.name)
) planted);

UPDATE apps_marketplace SET json = json - 'eventSubscriptions'
WHERE json -> 'eventSubscriptions' IS NOT NULL;

UPDATE entity_extension SET json = json - 'eventSubscriptions'
WHERE extension LIKE 'appMarketPlaceDefinition.version.%'
  AND json -> 'eventSubscriptions' IS NOT NULL;

-- change_event: an event that holds its entity as an object
UPDATE change_event
SET json = json #- '{entity,eventSubscriptions}'
WHERE entityType = 'appMarketPlaceDefinition'
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'object'
    THEN json -> 'entity' -> 'eventSubscriptions' IS NOT NULL
    ELSE false END;

-- change_event: an event that holds its entity as a string of JSON
UPDATE change_event
SET json = jsonb_set(json, '{entity}',
  to_jsonb(((json ->> 'entity')::jsonb - 'eventSubscriptions')::text))
WHERE entityType = 'appMarketPlaceDefinition'
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'string'
    THEN CASE WHEN (json ->> 'entity') LIKE '{%'
      THEN (json ->> 'entity')::jsonb -> 'eventSubscriptions' IS NOT NULL
      ELSE false END
    ELSE false END;

-- successful_sent_change_events: an event that holds its entity as an object
UPDATE successful_sent_change_events
SET json = json #- '{entity,eventSubscriptions}'
WHERE json ->> 'entityType' = 'appMarketPlaceDefinition'
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'object'
    THEN json -> 'entity' -> 'eventSubscriptions' IS NOT NULL
    ELSE false END;

-- successful_sent_change_events: an event that holds its entity as a string of JSON
UPDATE successful_sent_change_events
SET json = jsonb_set(json, '{entity}',
  to_jsonb(((json ->> 'entity')::jsonb - 'eventSubscriptions')::text))
WHERE json ->> 'entityType' = 'appMarketPlaceDefinition'
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'string'
    THEN CASE WHEN (json ->> 'entity') LIKE '{%'
      THEN (json ->> 'entity')::jsonb -> 'eventSubscriptions' IS NOT NULL
      ELSE false END
    ELSE false END;

-- consumers_dlq: an event that holds its entity as an object
UPDATE consumers_dlq
SET json = json #- '{changeEvent,entity,eventSubscriptions}'
WHERE json -> 'changeEvent' ->> 'entityType' = 'appMarketPlaceDefinition'
  AND CASE WHEN jsonb_typeof(json -> 'changeEvent' -> 'entity') = 'object'
    THEN json -> 'changeEvent' -> 'entity' -> 'eventSubscriptions' IS NOT NULL
    ELSE false END;

-- consumers_dlq: an event that holds its entity as a string of JSON
UPDATE consumers_dlq
SET json = jsonb_set(json, '{changeEvent,entity}',
  to_jsonb(((json -> 'changeEvent' ->> 'entity')::jsonb - 'eventSubscriptions')::text))
WHERE json -> 'changeEvent' ->> 'entityType' = 'appMarketPlaceDefinition'
  AND CASE WHEN jsonb_typeof(json -> 'changeEvent' -> 'entity') = 'string'
    THEN CASE WHEN (json -> 'changeEvent' ->> 'entity') LIKE '{%'
      THEN (json -> 'changeEvent' ->> 'entity')::jsonb -> 'eventSubscriptions' IS NOT NULL
      ELSE false END
    ELSE false END;

-- audit_log_event: an event that holds its entity as an object
UPDATE audit_log_event
SET event_json = (event_json::jsonb #- '{entity,eventSubscriptions}')::text
WHERE entity_type = 'appMarketPlaceDefinition'
  AND CASE WHEN event_json LIKE '{%'
    THEN CASE WHEN jsonb_typeof(event_json::jsonb -> 'entity') = 'object'
      THEN event_json::jsonb -> 'entity' -> 'eventSubscriptions' IS NOT NULL
      ELSE false END
    ELSE false END;

-- audit_log_event: an event that holds its entity as a string of JSON
UPDATE audit_log_event
SET event_json = (jsonb_set(event_json::jsonb, '{entity}',
  to_jsonb(((event_json::jsonb ->> 'entity')::jsonb - 'eventSubscriptions')::text)))::text
WHERE entity_type = 'appMarketPlaceDefinition'
  AND CASE WHEN event_json LIKE '{%'
    THEN CASE WHEN jsonb_typeof(event_json::jsonb -> 'entity') = 'string'
      THEN CASE WHEN (event_json::jsonb ->> 'entity') LIKE '{%'
        THEN (event_json::jsonb ->> 'entity')::jsonb -> 'eventSubscriptions' IS NOT NULL
        ELSE false END
      ELSE false END
    ELSE false END;

-- An app's alert list is filled from the app->alert relationship on every read and is no longer
-- stored. The copy in the app JSON, and any alert written into it by hand, leaves stored apps and
-- app versions; the relationship rows that record the app's own alerts stay.
UPDATE installed_apps SET json = json - 'eventSubscriptions'
WHERE json -> 'eventSubscriptions' IS NOT NULL;

UPDATE entity_extension SET json = json - 'eventSubscriptions'
WHERE extension LIKE 'app.version.%'
  AND json -> 'eventSubscriptions' IS NOT NULL;
