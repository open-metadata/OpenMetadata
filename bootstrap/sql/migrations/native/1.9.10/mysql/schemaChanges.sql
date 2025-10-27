-- Update DomainOnlyAccessPolicy with new rules structure
UPDATE policy_entity
SET json = JSON_SET(
    json,
    '$.rules',
    JSON_ARRAY(
        JSON_OBJECT(
            'name', 'DomainAccessDenyRule',
            'description', 'Deny access when domain check fails',
            'effect', 'deny',
            'resources', JSON_ARRAY('All'),
            'operations', JSON_ARRAY('All'),
            'condition', '!hasDomain()'
        ),
        JSON_OBJECT(
            'name', 'DomainAccessAllowRule',
            'description', 'Allow access when domain check passes',
            'effect', 'allow',
            'resources', JSON_ARRAY('All'),
            'operations', JSON_ARRAY('All'),
            'condition', 'hasDomain()'
        )
    )
)
WHERE name = 'DomainOnlyAccessPolicy';