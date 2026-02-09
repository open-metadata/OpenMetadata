UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{supportedServices}',
    '["Snowflake", "BigQuery", "Athena", "Redshift", "Postgres", "MySQL", "Mssql", "Oracle", "Trino", "SapHana"]'::jsonb
)
WHERE name = 'tableDiff'
  AND (
    json->'supportedServices' IS NULL
    OR json->'supportedServices' = '[]'::jsonb
  );

-- Add timezone parameter to tableDataToBeFresh test definition
UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{parameterDefinition}',
    (json->'parameterDefinition')::jsonb || jsonb_build_object(
        'name', 'timezone',
        'displayName', 'Timezone',
        'description', 'Timezone for the range calculation',
        'dataType', 'STRING',
        'required', false,
        'optionValues', '["UTC","Africa/Abidjan","Africa/Accra","Africa/Addis_Ababa","Africa/Algiers","Africa/Cairo","Africa/Casablanca","Africa/Johannesburg","Africa/Lagos","Africa/Nairobi","Africa/Tunis","America/Anchorage","America/Argentina/Buenos_Aires","America/Bogota","America/Caracas","America/Chicago","America/Denver","America/Edmonton","America/Halifax","America/Havana","America/Lima","America/Los_Angeles","America/Manaus","America/Mexico_City","America/New_York","America/Panama","America/Phoenix","America/Puerto_Rico","America/Regina","America/Santiago","America/Sao_Paulo","America/St_Johns","America/Toronto","America/Vancouver","America/Winnipeg","Antarctica/McMurdo","Asia/Almaty","Asia/Amman","Asia/Baghdad","Asia/Baku","Asia/Bangkok","Asia/Beirut","Asia/Colombo","Asia/Damascus","Asia/Dhaka","Asia/Dubai","Asia/Ho_Chi_Minh","Asia/Hong_Kong","Asia/Istanbul","Asia/Jakarta","Asia/Jerusalem","Asia/Kabul","Asia/Karachi","Asia/Kathmandu","Asia/Kolkata","Asia/Kuala_Lumpur","Asia/Kuwait","Asia/Manila","Asia/Muscat","Asia/Nicosia","Asia/Novosibirsk","Asia/Qatar","Asia/Riyadh","Asia/Seoul","Asia/Shanghai","Asia/Singapore","Asia/Taipei","Asia/Tashkent","Asia/Tehran","Asia/Tokyo","Asia/Vladivostok","Asia/Yangon","Asia/Yekaterinburg","Atlantic/Azores","Atlantic/Canary","Atlantic/Cape_Verde","Atlantic/Reykjavik","Australia/Adelaide","Australia/Brisbane","Australia/Darwin","Australia/Hobart","Australia/Melbourne","Australia/Perth","Australia/Sydney","Europe/Amsterdam","Europe/Athens","Europe/Belgrade","Europe/Berlin","Europe/Brussels","Europe/Bucharest","Europe/Budapest","Europe/Copenhagen","Europe/Dublin","Europe/Helsinki","Europe/Kyiv","Europe/Lisbon","Europe/London","Europe/Madrid","Europe/Malta","Europe/Minsk","Europe/Moscow","Europe/Oslo","Europe/Paris","Europe/Prague","Europe/Riga","Europe/Rome","Europe/Samara","Europe/Sofia","Europe/Stockholm","Europe/Tallinn","Europe/Vienna","Europe/Vilnius","Europe/Warsaw","Europe/Zurich","Indian/Maldives","Indian/Mauritius","Pacific/Auckland","Pacific/Fiji","Pacific/Guam","Pacific/Honolulu","Pacific/Noumea","Pacific/Pago_Pago","Pacific/Port_Moresby","Pacific/Tahiti","Pacific/Tongatapu"]'::jsonb,
        'defaultValue', 'UTC'
    )::jsonb
)
WHERE name = 'tableDataToBeFresh'
  AND NOT (json->'parameterDefinition' @> '[{"name": "timezone"}]'::jsonb);

-- Add parameters back in tableRowInsertedCountToBeBetween if missing
UPDATE test_definition
SET json = jsonb_set(
    json,
    '{parameterDefinition}',
    (
        SELECT jsonb_agg(elem)
        FROM (
            -- Keep existing elements
            SELECT elem
            FROM jsonb_array_elements(json -> 'parameterDefinition') AS elem
            
            UNION ALL
            
            -- Add columnName if not exists
            SELECT jsonb_build_object(
                'name', 'columnName',
                'dataType', 'STRING',
                'required', true,
                'description', 'Name of the Column to check for new rows inserted.',
                'displayName', 'Column Name',
                'optionValues', '[]'::jsonb
            )
            WHERE NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(json -> 'parameterDefinition') AS e
                WHERE e ->> 'name' = 'columnName'
            )
            
            UNION ALL
            
            -- Add rangeType if not exists
            SELECT jsonb_build_object(
                'name', 'rangeType',
                'dataType', 'STRING',
                'required', true,
                'description', 'One of ''HOUR'', ''DAY'', ''MONTH'', ''YEAR'' to specify the range type for checking new rows inserted.',
                'displayName', 'Range Type',
                'optionValues', '[]'::jsonb
            )
            WHERE NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(json -> 'parameterDefinition') AS e
                WHERE e ->> 'name' = 'rangeType'
            )
            
            UNION ALL
            
            -- Add rangeInterval if not exists
            SELECT jsonb_build_object(
                'name', 'rangeInterval',
                'dataType', 'INT',
                'required', true,
                'description', 'Interval Range. E.g. if rangeInterval=1 and rangeType=DAY, we''ll check the numbers of rows inserted where columnName=-1 DAY',
                'displayName', 'Interval',
                'optionValues', '[]'::jsonb
            )
            WHERE NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(json -> 'parameterDefinition') AS e
                WHERE e ->> 'name' = 'rangeInterval'
            )
        ) AS combined
    )
)
WHERE name = 'tableRowInsertedCountToBeBetween';

-- Add validatorClass to all system test definitions (set to PascalCase name + 'Validator' if not present)
UPDATE test_definition
SET json = jsonb_set(json::jsonb, '{validatorClass}', to_jsonb(INITCAP(SUBSTRING(json->>'name', 1, 1)) || SUBSTRING(json->>'name', 2) || 'Validator'))
WHERE json->>'validatorClass' IS NULL
  AND json->>'provider' = 'system';

-- Remove orphaned inputPorts and outputPorts fields from data_product_entity
-- These fields were added in 1.10.x but removed in 1.12.x (now relationship-based)
UPDATE data_product_entity
SET json = json - 'inputPorts' - 'outputPorts'
WHERE json ?? 'inputPorts' OR json ?? 'outputPorts';

-- Remove orphaned inputPorts and outputPorts fields from entity_extension (version history)
UPDATE entity_extension
SET json = json::jsonb - 'inputPorts' - 'outputPorts'
WHERE jsonSchema = 'dataProduct'
  AND (json::jsonb ?? 'inputPorts' OR json::jsonb ?? 'outputPorts');
