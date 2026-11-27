-- A PUT on a default policy or role used to store it without its system marks, which left it
-- deletable. Restore them on the defaults seeded with provider system and allowDelete false.
UPDATE policy_entity
SET json = JSON_SET(json, '$.provider', 'system', '$.allowDelete', CAST('false' AS JSON))
WHERE name IN (
    'ApplicationBotImpersonationPolicy', 'ApplicationBotPolicy', 'AutoClassificationBotPolicy',
    'BotImpersonationPolicy', 'BotNonAdminImpersonationPolicy', 'DataConsumerPolicy',
    'DataStewardPolicy', 'DefaultBotPolicy', 'IngestionBotPolicy', 'LineageBotPolicy',
    'OrganizationPolicy', 'ProfilerBotPolicy', 'QualityBotPolicy', 'ScimBotPolicy',
    'TaskAuthorPolicy', 'TeamOnlyPolicy', 'UsageBotPolicy')
  AND (COALESCE(json ->> '$.provider', '') <> 'system'
    OR COALESCE(json ->> '$.allowDelete', '') <> 'false');

UPDATE role_entity
SET json = JSON_SET(json, '$.provider', 'system', '$.allowDelete', CAST('false' AS JSON))
WHERE name IN (
    'ApplicationBotImpersonationRole', 'ApplicationBotRole', 'AutoClassificationBotRole',
    'BotImpersonationRole', 'BotNonAdminImpersonationRole', 'DataConsumer', 'DataQualityBotRole',
    'DataSteward', 'DefaultBotRole', 'GovernanceBotRole', 'IngestionBotRole', 'LineageBotRole',
    'ProfilerBotRole', 'QualityBotRole', 'ScimBotRole', 'UsageBotRole')
  AND (COALESCE(json ->> '$.provider', '') <> 'system'
    OR COALESCE(json ->> '$.allowDelete', '') <> 'false');
