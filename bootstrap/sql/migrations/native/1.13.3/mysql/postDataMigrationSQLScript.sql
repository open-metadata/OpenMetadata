-- Backfill IntakeForm formFields from the legacy requiredFields representation.
-- requiredFields is only trusted when it is actually an array, and only object
-- entries are carried over, so a JSON null or scalar left by an older write can
-- never turn into a malformed formFields array.
UPDATE intake_form_entity AS intake_form
SET json = JSON_SET(
    json,
    '$.formFields',
    COALESCE(
        (
            SELECT JSON_ARRAYAGG(
                JSON_SET(required_field.field_json, '$.required', CAST('true' AS JSON))
            )
            FROM JSON_TABLE(
                CASE
                    WHEN JSON_TYPE(JSON_EXTRACT(intake_form.json, '$.requiredFields')) = 'ARRAY'
                        THEN JSON_EXTRACT(intake_form.json, '$.requiredFields')
                    ELSE JSON_ARRAY()
                END,
                '$[*]' COLUMNS (field_json JSON PATH '$')
            ) AS required_field
            WHERE JSON_TYPE(required_field.field_json) = 'OBJECT'
        ),
        JSON_ARRAY()
    )
)
WHERE JSON_CONTAINS_PATH(json, 'one', '$.requiredFields')
  AND NOT JSON_CONTAINS_PATH(json, 'one', '$.formFields');
