-- End MCP OAuth grants of users who no longer exist or are deleted. Grants are keyed by user name,
-- so a later user given the same name would otherwise take them over; deleting a user now ends
-- its grants, and this clears the ones left from before. The second run changes nothing.
DELETE FROM oauth_authorization_codes
WHERE NOT EXISTS (SELECT 1 FROM user_entity u WHERE LOWER(u.name) = LOWER(oauth_authorization_codes.user_name) AND u.deleted IS NOT TRUE);
UPDATE oauth_refresh_tokens SET revoked = TRUE
WHERE revoked = FALSE
  AND NOT EXISTS (SELECT 1 FROM user_entity u WHERE LOWER(u.name) = LOWER(oauth_refresh_tokens.user_name) AND u.deleted IS NOT TRUE);
DELETE FROM oauth_access_tokens
WHERE NOT EXISTS (SELECT 1 FROM user_entity u WHERE LOWER(u.name) = LOWER(oauth_access_tokens.user_name) AND u.deleted IS NOT TRUE);

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
