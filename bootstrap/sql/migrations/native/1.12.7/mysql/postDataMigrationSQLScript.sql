WITH
field_changes AS (
    SELECT e.id, e.extension, jt.field_name
    FROM entity_extension AS e
    JOIN JSON_TABLE(
        COALESCE(JSON_EXTRACT(e.json, '$.changeDescription.fieldsAdded'), JSON_ARRAY()),
        '$[*]' COLUMNS (field_name VARCHAR(1024) PATH '$.name')
    ) AS jt ON TRUE
    WHERE e.extension LIKE '%.version.%'

    UNION ALL

    SELECT e.id, e.extension, jt.field_name
    FROM entity_extension AS e
    JOIN JSON_TABLE(
        COALESCE(JSON_EXTRACT(e.json, '$.changeDescription.fieldsUpdated'), JSON_ARRAY()),
        '$[*]' COLUMNS (field_name VARCHAR(1024) PATH '$.name')
    ) AS jt ON TRUE
    WHERE e.extension LIKE '%.version.%'

    UNION ALL

    SELECT e.id, e.extension, jt.field_name
    FROM entity_extension AS e
    JOIN JSON_TABLE(
        COALESCE(JSON_EXTRACT(e.json, '$.changeDescription.fieldsDeleted'), JSON_ARRAY()),
        '$[*]' COLUMNS (field_name VARCHAR(1024) PATH '$.name')
    ) AS jt ON TRUE
    WHERE e.extension LIKE '%.version.%'
),
distinct_field_changes AS (
    SELECT DISTINCT id, extension, field_name
    FROM field_changes
    WHERE field_name IS NOT NULL
      AND field_name <> ''
),
version_metadata AS (
    SELECT
        e.id,
        e.extension,
        CAST(SUBSTRING_INDEX(e.extension, '.version.', -1) AS DOUBLE) AS version_num,
        CASE
            WHEN COUNT(fc.field_name) = 0 THEN JSON_ARRAY()
            ELSE JSON_ARRAYAGG(fc.field_name)
        END AS changed_field_keys
    FROM entity_extension AS e
    LEFT JOIN distinct_field_changes AS fc
        ON fc.id = e.id
       AND fc.extension = e.extension
    WHERE e.extension LIKE '%.version.%'
    GROUP BY e.id, e.extension
)
UPDATE entity_extension AS e
JOIN version_metadata AS vm
    ON vm.id = e.id AND vm.extension = e.extension
SET e.versionNum = vm.version_num,
    e.changedFieldKeys = vm.changed_field_keys;
