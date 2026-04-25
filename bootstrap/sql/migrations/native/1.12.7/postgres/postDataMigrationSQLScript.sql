WITH version_metadata AS (
    SELECT
        e.id,
        e.extension,
        split_part(e.extension, '.version.', 2)::DOUBLE PRECISION AS version_num,
        COALESCE(
            (
                SELECT jsonb_agg(field_name ORDER BY field_name)
                FROM (
                    SELECT DISTINCT
                        field_change ->> 'name' AS field_name
                    FROM jsonb_array_elements(
                        COALESCE(e.json -> 'changeDescription' -> 'fieldsAdded', '[]'::jsonb)
                    ) AS field_change
                    WHERE field_change ->> 'name' IS NOT NULL
                      AND field_change ->> 'name' <> ''

                    UNION

                    SELECT DISTINCT
                        field_change ->> 'name' AS field_name
                    FROM jsonb_array_elements(
                        COALESCE(e.json -> 'changeDescription' -> 'fieldsUpdated', '[]'::jsonb)
                    ) AS field_change
                    WHERE field_change ->> 'name' IS NOT NULL
                      AND field_change ->> 'name' <> ''

                    UNION

                    SELECT DISTINCT
                        field_change ->> 'name' AS field_name
                    FROM jsonb_array_elements(
                        COALESCE(e.json -> 'changeDescription' -> 'fieldsDeleted', '[]'::jsonb)
                    ) AS field_change
                    WHERE field_change ->> 'name' IS NOT NULL
                      AND field_change ->> 'name' <> ''
                ) AS exact_field_names
            ),
            '[]'::jsonb
        ) AS changed_field_keys
    FROM entity_extension AS e
    WHERE e.extension LIKE '%.version.%'
)
UPDATE entity_extension AS e
SET versionNum = version_metadata.version_num,
    changedFieldKeys = version_metadata.changed_field_keys
FROM version_metadata
WHERE e.id = version_metadata.id
  AND e.extension = version_metadata.extension;
