-- Remove Duplicate UserNames and lowercase them
WITH cte AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY to_jsonb(LOWER(json->>'name')) ORDER BY id) as rn
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
    '{name}',
    to_jsonb(LOWER(json->>'name'))
);

-- Remove Duplicate Emails and lowercase them
WITH cte AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY to_jsonb(LOWER(json->>'email')) ORDER BY id) as rn
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
    '{email}',
    to_jsonb(LOWER(json->>'email'))
);
