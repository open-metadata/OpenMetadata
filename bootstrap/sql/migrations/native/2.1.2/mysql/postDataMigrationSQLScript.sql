-- A PUT on a default policy or role used to store it without its system marks, which left it
-- deletable. Restore them on the defaults seeded with provider system and allowDelete false.
UPDATE policy_entity
SET json = JSON_SET(json, '$.provider', 'system', '$.allowDelete', CAST('false' AS JSON))
WHERE name IN (
    'ApplicationBotImpersonationPolicy', 'ApplicationBotPolicy', 'AutoClassificationBotPolicy',
    'BotImpersonationPolicy', 'BotNonAdminImpersonationPolicy', 'DataConsumerPolicy',
    'DataStewardPolicy', 'DefaultBotPolicy', 'IngestionBotPolicy', 'LineageBotPolicy',
    'OntologyAuthorPolicy', 'OntologyReviewerPolicy', 'OrganizationPolicy', 'ProfilerBotPolicy',
    'QualityBotPolicy', 'ScimBotPolicy', 'TaskAuthorPolicy', 'TeamOnlyPolicy', 'UsageBotPolicy')
  AND (COALESCE(json ->> '$.provider', '') <> 'system'
    OR COALESCE(json ->> '$.allowDelete', '') <> 'false');

UPDATE role_entity
SET json = JSON_SET(json, '$.provider', 'system', '$.allowDelete', CAST('false' AS JSON))
WHERE name IN (
    'ApplicationBotImpersonationRole', 'ApplicationBotRole', 'AutoClassificationBotRole',
    'BotImpersonationRole', 'BotNonAdminImpersonationRole', 'DataConsumer', 'DataQualityBotRole',
    'DataSteward', 'DefaultBotRole', 'GovernanceBotRole', 'IngestionBotRole', 'LineageBotRole',
    'OntologyAuthor', 'OntologyReviewer', 'ProfilerBotRole', 'QualityBotRole', 'ScimBotRole',
    'UsageBotRole')
  AND (COALESCE(json ->> '$.provider', '') <> 'system'
    OR COALESCE(json ->> '$.allowDelete', '') <> 'false');

-- Offer Table Diff on Vertica.
-- tableDiff.json gained Vertica, but test definitions are seed data and
-- initializeEntity() skips a row that already exists, so an upgraded deployment
-- keeps its previous list. An empty list already means "every service", so leave
-- it alone rather than narrowing it to one.
UPDATE test_definition
SET json = JSON_ARRAY_APPEND(json, '$.supportedServices', 'Vertica')
WHERE name = 'tableDiff'
  AND JSON_TYPE(JSON_EXTRACT(json, '$.supportedServices')) = 'ARRAY'
  AND JSON_LENGTH(JSON_EXTRACT(json, '$.supportedServices')) > 0
  AND NOT JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedServices'), JSON_QUOTE('Vertica'));
