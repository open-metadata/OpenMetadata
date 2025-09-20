-- Update DomainOnlyAccessPolicy with new rules structure
UPDATE policy_entity
SET json = jsonb_set(
    json,
    '{rules}',
    '[
        {
            "name": "DomainAccessDenyRule",
            "description": "Deny access when domain check fails",
            "effect": "deny",
            "resources": ["All"],
            "operations": ["All"],
            "condition": "!hasDomain()"
        },
        {
            "name": "DomainAccessAllowRule",
            "description": "Allow access when domain check passes",
            "effect": "allow",
            "resources": ["All"],
            "operations": ["All"],
            "condition": "hasDomain()"
        }
    ]'::jsonb
)
WHERE name = 'DomainOnlyAccessPolicy';