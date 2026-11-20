-- Change events never carry a user's authenticationMechanism; apply that to events stored earlier.
UPDATE change_event
SET json = json #- '{entity,authenticationMechanism}'
WHERE entityType = 'user'
  AND jsonb_typeof(json -> 'entity') = 'object'
  AND jsonb_exists(json -> 'entity', 'authenticationMechanism');

UPDATE change_event
SET json = jsonb_set(json, '{entity}',
    to_jsonb(((json ->> 'entity')::jsonb - 'authenticationMechanism')::text))
WHERE entityType = 'user'
  AND jsonb_typeof(json -> 'entity') = 'string'
  AND json ->> 'entity' LIKE '%"authenticationMechanism"%';

UPDATE audit_log_event
SET event_json = (event_json::jsonb #- '{entity,authenticationMechanism}')::text
WHERE entity_type = 'user'
  AND event_json LIKE '%"authenticationMechanism"%'
  AND jsonb_typeof(event_json::jsonb -> 'entity') = 'object'
  AND jsonb_exists(event_json::jsonb -> 'entity', 'authenticationMechanism');

UPDATE audit_log_event
SET event_json = jsonb_set(event_json::jsonb, '{entity}',
    to_jsonb(((event_json::jsonb ->> 'entity')::jsonb - 'authenticationMechanism')::text))::text
WHERE entity_type = 'user'
  AND event_json LIKE '%authenticationMechanism%'
  AND jsonb_typeof(event_json::jsonb -> 'entity') = 'string';

UPDATE successful_sent_change_events
SET json = json #- '{entity,authenticationMechanism}'
WHERE json ->> 'entityType' = 'user'
  AND jsonb_typeof(json -> 'entity') = 'object'
  AND jsonb_exists(json -> 'entity', 'authenticationMechanism');

UPDATE successful_sent_change_events
SET json = jsonb_set(json, '{entity}',
    to_jsonb(((json ->> 'entity')::jsonb - 'authenticationMechanism')::text))
WHERE json ->> 'entityType' = 'user'
  AND jsonb_typeof(json -> 'entity') = 'string'
  AND json ->> 'entity' LIKE '%"authenticationMechanism"%';

UPDATE consumers_dlq
SET json = json #- '{changeEvent,entity,authenticationMechanism}'
WHERE json #>> '{changeEvent,entityType}' = 'user'
  AND jsonb_typeof(json #> '{changeEvent,entity}') = 'object'
  AND jsonb_exists(json #> '{changeEvent,entity}', 'authenticationMechanism');

UPDATE consumers_dlq
SET json = jsonb_set(json, '{changeEvent,entity}',
    to_jsonb(((json #>> '{changeEvent,entity}')::jsonb - 'authenticationMechanism')::text))
WHERE json #>> '{changeEvent,entityType}' = 'user'
  AND jsonb_typeof(json #> '{changeEvent,entity}') = 'string'
  AND json #>> '{changeEvent,entity}' LIKE '%"authenticationMechanism"%';
