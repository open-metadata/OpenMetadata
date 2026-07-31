-- Backfill IntakeForm formFields from the legacy requiredFields representation.
-- requiredFields is only trusted when it is actually an array: jsonb_array_elements
-- raises "cannot extract elements from a scalar" on a JSON null or scalar value,
-- which would abort the whole upgrade for one malformed row. Non-object entries
-- are skipped for the same reason.
UPDATE intake_form_entity
SET json = jsonb_set(
    json,
    '{formFields}',
    COALESCE(
        (
            SELECT jsonb_agg(required_field.field_json || '{"required": true}'::jsonb)
            FROM jsonb_array_elements(
                CASE
                    WHEN jsonb_typeof(json -> 'requiredFields') = 'array'
                        THEN json -> 'requiredFields'
                    ELSE '[]'::jsonb
                END
            ) AS required_field(field_json)
            WHERE jsonb_typeof(required_field.field_json) = 'object'
        ),
        '[]'::jsonb
    )
)
WHERE jsonb_exists(json, 'requiredFields')
  AND NOT jsonb_exists(json, 'formFields');
