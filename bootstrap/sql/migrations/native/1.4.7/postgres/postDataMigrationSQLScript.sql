-- Remove Duplicate FullyQualifiedName and lowercase
WITH cte AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY to_jsonb(LOWER(json->>'fullyQualifiedName')) ORDER BY id) as rn
    FROM 
        user_entity
)
DELETE from user_entity
WHERE id IN (
    SELECT id
    FROM cte
    WHERE rn > 1
);

UPDATE user_entity
SET json = jsonb_set(
    json,
    '{fullyQualifiedName}',
    to_jsonb(LOWER(json->>'fullyQualifiedName'))
);

UPDATE user_entity SET nameHash = MD5(json ->> 'fullyQualifiedName');