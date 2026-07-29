-- Backfill IntakeForm formFields from the legacy requiredFields representation.
UPDATE intake_form_entity
SET json = jsonb_set(
    json,
    '{formFields}',
    COALESCE(
        (
            SELECT jsonb_agg(required_field.field_json || '{"required": true}'::jsonb)
            FROM jsonb_array_elements(json->'requiredFields') AS required_field(field_json)
        ),
        '[]'::jsonb
    )
)
WHERE jsonb_exists(json, 'requiredFields')
  AND NOT jsonb_exists(json, 'formFields');
