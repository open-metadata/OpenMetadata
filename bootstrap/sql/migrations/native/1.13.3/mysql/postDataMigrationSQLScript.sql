-- Backfill IntakeForm formFields from the legacy requiredFields representation.
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
                JSON_EXTRACT(intake_form.json, '$.requiredFields'),
                '$[*]' COLUMNS (field_json JSON PATH '$')
            ) AS required_field
        ),
        JSON_ARRAY()
    )
)
WHERE JSON_CONTAINS_PATH(json, 'one', '$.requiredFields')
  AND NOT JSON_CONTAINS_PATH(json, 'one', '$.formFields');
