-- End MCP OAuth grants of users who no longer exist or are deleted. Grants are keyed by user name,
-- so a later user given the same name would otherwise take them over; deleting a user now ends
-- its grants, and this clears the ones left from before. The second run changes nothing.
DELETE FROM oauth_authorization_codes
WHERE NOT EXISTS (SELECT 1 FROM user_entity u WHERE u.name = oauth_authorization_codes.user_name COLLATE utf8mb4_0900_ai_ci AND u.deleted IS NOT TRUE);
UPDATE oauth_refresh_tokens SET revoked = TRUE
WHERE revoked = FALSE
  AND NOT EXISTS (SELECT 1 FROM user_entity u WHERE u.name = oauth_refresh_tokens.user_name COLLATE utf8mb4_0900_ai_ci AND u.deleted IS NOT TRUE);
DELETE FROM oauth_access_tokens
WHERE NOT EXISTS (SELECT 1 FROM user_entity u WHERE u.name = oauth_access_tokens.user_name COLLATE utf8mb4_0900_ai_ci AND u.deleted IS NOT TRUE);

-- Change events never carry a user's authenticationMechanism; apply that to events stored earlier.
UPDATE change_event
SET json = JSON_REMOVE(json, '$.entity.authenticationMechanism')
WHERE entityType = 'user'
  AND JSON_CONTAINS_PATH(json, 'one', '$.entity.authenticationMechanism');

UPDATE change_event
SET json = JSON_SET(json, '$.entity',
    CAST(JSON_REMOVE(CAST(json ->> '$.entity' AS JSON), '$.authenticationMechanism') AS CHAR))
WHERE entityType = 'user'
  AND JSON_TYPE(json -> '$.entity') = 'STRING'
  AND json ->> '$.entity' LIKE '%"authenticationMechanism"%'
  AND JSON_VALID(json ->> '$.entity');

UPDATE audit_log_event
SET event_json = JSON_REMOVE(event_json, '$.entity.authenticationMechanism')
WHERE entity_type = 'user'
  AND event_json LIKE '%authenticationMechanism%'
  AND JSON_CONTAINS_PATH(IF(JSON_VALID(event_json), event_json, '{}'), 'one', '$.entity.authenticationMechanism');

UPDATE audit_log_event
SET event_json = JSON_SET(event_json, '$.entity',
    CAST(JSON_REMOVE(CAST(JSON_UNQUOTE(JSON_EXTRACT(event_json, '$.entity')) AS JSON), '$.authenticationMechanism') AS CHAR))
WHERE entity_type = 'user'
  AND event_json LIKE '%authenticationMechanism%'
  AND JSON_TYPE(JSON_EXTRACT(IF(JSON_VALID(event_json), event_json, '{}'), '$.entity')) = 'STRING'
  AND JSON_VALID(JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(event_json), event_json, '{}'), '$.entity')));

UPDATE successful_sent_change_events
SET json = JSON_REMOVE(json, '$.entity.authenticationMechanism')
WHERE json ->> '$.entityType' = 'user'
  AND JSON_CONTAINS_PATH(json, 'one', '$.entity.authenticationMechanism');

UPDATE successful_sent_change_events
SET json = JSON_SET(json, '$.entity',
    CAST(JSON_REMOVE(CAST(json ->> '$.entity' AS JSON), '$.authenticationMechanism') AS CHAR))
WHERE json ->> '$.entityType' = 'user'
  AND JSON_TYPE(json -> '$.entity') = 'STRING'
  AND json ->> '$.entity' LIKE '%"authenticationMechanism"%'
  AND JSON_VALID(json ->> '$.entity');

UPDATE consumers_dlq
SET json = JSON_REMOVE(json, '$.changeEvent.entity.authenticationMechanism')
WHERE json ->> '$.changeEvent.entityType' = 'user'
  AND JSON_CONTAINS_PATH(json, 'one', '$.changeEvent.entity.authenticationMechanism');

UPDATE consumers_dlq
SET json = JSON_SET(json, '$.changeEvent.entity',
    CAST(JSON_REMOVE(CAST(json ->> '$.changeEvent.entity' AS JSON), '$.authenticationMechanism') AS CHAR))
WHERE json ->> '$.changeEvent.entityType' = 'user'
  AND JSON_TYPE(json -> '$.changeEvent.entity') = 'STRING'
  AND json ->> '$.changeEvent.entity' LIKE '%"authenticationMechanism"%'
  AND JSON_VALID(json ->> '$.changeEvent.entity');
