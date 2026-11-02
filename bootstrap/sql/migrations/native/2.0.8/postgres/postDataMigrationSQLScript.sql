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
