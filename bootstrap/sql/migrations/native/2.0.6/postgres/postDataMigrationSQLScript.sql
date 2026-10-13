-- Say how to choose tableCustomSQLQuery.strategy and what columnValuesToBeInSet.matchEnum changes,
-- so users and test generation read it from the definition. Seed data only creates missing definitions.
UPDATE test_definition
SET json = jsonb_set(
    json,
    '{parameterDefinition}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN param->>'name' = 'strategy' THEN param || jsonb_build_object(
                    'description',
                    'How the query result is compared to the threshold. ROWS (default): the query returns the rows that break the rule, such as `SELECT * FROM t WHERE amount < 0`, and the number of rows returned is compared. COUNT: the query returns a single integer, such as `SELECT COUNT(*) FROM t WHERE amount < 0`, and that number is compared. Under ROWS a `SELECT COUNT(*)` query always returns one row. Do not use COUNT with a query that can return NULL or a non-integer, such as SUM or AVG.'
                )
                ELSE param
            END
            ORDER BY position
        )
        FROM jsonb_array_elements(json->'parameterDefinition') WITH ORDINALITY AS params(param, position)
    )
)
WHERE name = 'tableCustomSQLQuery'
  AND json->'parameterDefinition' @> '[{"name": "strategy"}]'::jsonb;

UPDATE test_definition
SET json = jsonb_set(
    json,
    '{parameterDefinition}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN param->>'name' = 'matchEnum' THEN param || jsonb_build_object(
                    'description',
                    'If enabled, every value in the column must be in the set, and each value outside it counts as a failed row. If disabled, the test passes as soon as one value is in the set, whatever the other values hold.'
                )
                ELSE param
            END
            ORDER BY position
        )
        FROM jsonb_array_elements(json->'parameterDefinition') WITH ORDINALITY AS params(param, position)
    )
)
WHERE name = 'columnValuesToBeInSet'
  AND json->'parameterDefinition' @> '[{"name": "matchEnum"}]'::jsonb;
