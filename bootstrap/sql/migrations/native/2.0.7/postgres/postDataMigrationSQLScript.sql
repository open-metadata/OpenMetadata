-- Apps no longer bring their own alerts. No shipped app listed any, so every alert an app
-- install created came from someone editing a definition: it is kept for an admin to review,
-- disabled and no longer tied to the app (relation 0 is CONTAINS). The list then leaves every
-- stored app, definition, version and change event.

-- event_subscription_entity: alerts an app install created
UPDATE event_subscription_entity
SET json = jsonb_set(json, '{enabled}', 'false'::jsonb)
WHERE id IN (SELECT toId FROM entity_relationship WHERE fromEntity = 'app' AND toEntity = 'eventsubscription' AND relation = 0);

DELETE FROM entity_relationship WHERE fromEntity = 'app' AND toEntity = 'eventsubscription' AND relation = 0;

UPDATE apps_marketplace SET json = json - 'eventSubscriptions'
WHERE json -> 'eventSubscriptions' IS NOT NULL;

UPDATE installed_apps SET json = json - 'eventSubscriptions'
WHERE json -> 'eventSubscriptions' IS NOT NULL;

UPDATE entity_extension SET json = json - 'eventSubscriptions'
WHERE (extension LIKE 'app.version.%' OR extension LIKE 'appMarketPlaceDefinition.version.%')
  AND json -> 'eventSubscriptions' IS NOT NULL;

-- change_event: an event that holds its entity as an object
UPDATE change_event
SET json = json #- '{entity,eventSubscriptions}'
WHERE entityType IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'object'
    THEN json -> 'entity' -> 'eventSubscriptions' IS NOT NULL
    ELSE false END;

-- change_event: an event that holds its entity as a string of JSON
UPDATE change_event
SET json = jsonb_set(json, '{entity}',
  to_jsonb(((json ->> 'entity')::jsonb - 'eventSubscriptions')::text))
WHERE entityType IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'string'
    THEN CASE WHEN (json ->> 'entity') LIKE '{%'
      THEN (json ->> 'entity')::jsonb -> 'eventSubscriptions' IS NOT NULL
      ELSE false END
    ELSE false END;

-- successful_sent_change_events: an event that holds its entity as an object
UPDATE successful_sent_change_events
SET json = json #- '{entity,eventSubscriptions}'
WHERE json ->> 'entityType' IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'object'
    THEN json -> 'entity' -> 'eventSubscriptions' IS NOT NULL
    ELSE false END;

-- successful_sent_change_events: an event that holds its entity as a string of JSON
UPDATE successful_sent_change_events
SET json = jsonb_set(json, '{entity}',
  to_jsonb(((json ->> 'entity')::jsonb - 'eventSubscriptions')::text))
WHERE json ->> 'entityType' IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'string'
    THEN CASE WHEN (json ->> 'entity') LIKE '{%'
      THEN (json ->> 'entity')::jsonb -> 'eventSubscriptions' IS NOT NULL
      ELSE false END
    ELSE false END;

-- consumers_dlq: an event that holds its entity as an object
UPDATE consumers_dlq
SET json = json #- '{changeEvent,entity,eventSubscriptions}'
WHERE json -> 'changeEvent' ->> 'entityType' IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN jsonb_typeof(json -> 'changeEvent' -> 'entity') = 'object'
    THEN json -> 'changeEvent' -> 'entity' -> 'eventSubscriptions' IS NOT NULL
    ELSE false END;

-- consumers_dlq: an event that holds its entity as a string of JSON
UPDATE consumers_dlq
SET json = jsonb_set(json, '{changeEvent,entity}',
  to_jsonb(((json -> 'changeEvent' ->> 'entity')::jsonb - 'eventSubscriptions')::text))
WHERE json -> 'changeEvent' ->> 'entityType' IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN jsonb_typeof(json -> 'changeEvent' -> 'entity') = 'string'
    THEN CASE WHEN (json -> 'changeEvent' ->> 'entity') LIKE '{%'
      THEN (json -> 'changeEvent' ->> 'entity')::jsonb -> 'eventSubscriptions' IS NOT NULL
      ELSE false END
    ELSE false END;

-- audit_log_event: an event that holds its entity as an object
UPDATE audit_log_event
SET event_json = (event_json::jsonb #- '{entity,eventSubscriptions}')::text
WHERE entity_type IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN event_json LIKE '{%'
    THEN CASE WHEN jsonb_typeof(event_json::jsonb -> 'entity') = 'object'
      THEN event_json::jsonb -> 'entity' -> 'eventSubscriptions' IS NOT NULL
      ELSE false END
    ELSE false END;

-- audit_log_event: an event that holds its entity as a string of JSON
UPDATE audit_log_event
SET event_json = (jsonb_set(event_json::jsonb, '{entity}',
  to_jsonb(((event_json::jsonb ->> 'entity')::jsonb - 'eventSubscriptions')::text)))::text
WHERE entity_type IN ('app', 'appMarketPlaceDefinition')
  AND CASE WHEN event_json LIKE '{%'
    THEN CASE WHEN jsonb_typeof(event_json::jsonb -> 'entity') = 'string'
      THEN CASE WHEN (event_json::jsonb ->> 'entity') LIKE '{%'
        THEN (event_json::jsonb ->> 'entity')::jsonb -> 'eventSubscriptions' IS NOT NULL
        ELSE false END
      ELSE false END
    ELSE false END;
