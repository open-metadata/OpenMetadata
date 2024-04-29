-- Start of Test Definition Parameter Definition Validation Migration
UPDATE test_definition
SET json = jsonb_set(
    jsonb_delete(json, '$.parameterDefinition'),
    '{parameterDefinition}',
    jsonb_build_array(
        jsonb_build_object(
            'name', 'minValue',
            'dataType', 'INT',
            'required', false,
            'description', 'The {minValue} value for the column entry. If minValue is not included, maxValue is treated as upperBound and there will be no minimum',
            'displayName', 'Min',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'maxValue',
                'rule', 'LESS_THAN_OR_EQUALS'
            )
        ),
        jsonb_build_object(
            'name', 'maxValue',
            'dataType', 'INT',
            'required', false,
            'description', 'The {maxValue} value for the column entry. if maxValue is not included, minValue is treated as lowerBound and there will be no maximum',
            'displayName', 'Max',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'minValue',
                'rule', 'GREATER_THAN_OR_EQUALS'
            )
        )
    )
)
WHERE name = 'columnValuesToBeBetween';

UPDATE test_definition
SET json = jsonb_set(
    jsonb_delete(json, '$.parameterDefinition'),
    '{parameterDefinition}',
    jsonb_build_array(
        jsonb_build_object(
            'name', 'minValueForMaxInCol',
            'dataType', 'INT',
            'required', false,
            'description', 'Expected minimum value in the column to be greater or equal than',
            'displayName', 'Min',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'maxValueForMaxInCol',
                'rule', 'LESS_THAN_OR_EQUALS'
            )
        ),
        jsonb_build_object(
            'name', 'maxValueForMaxInCol',
            'dataType', 'INT',
            'required', false,
            'description', 'Expected maximum value in the column to be lower or equal than',
            'displayName', 'Max',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'minValueForMaxInCol',
                'rule', 'GREATER_THAN_OR_EQUALS'
            )
        )
    )
)
WHERE name = 'columnValueMaxToBeBetween';

UPDATE test_definition
SET json = jsonb_set(
    jsonb_delete(json, '$.parameterDefinition'),
    '{parameterDefinition}',
    jsonb_build_array(
        jsonb_build_object(
            'name', 'minValueForMeanInCol',
            'dataType', 'INT',
            'required', false,
            'description', 'Expected mean value for the column to be greater or equal than',
            'displayName', 'Min',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'maxValueForMeanInCol',
                'rule', 'LESS_THAN_OR_EQUALS'
            )
        ),
        jsonb_build_object(
            'name', 'maxValueForMeanInCol',
            'dataType', 'INT',
            'required', false,
            'description', 'Expected mean value for the column to be lower or equal than',
            'displayName', 'Max',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'minValueForMeanInCol',
                'rule', 'GREATER_THAN_OR_EQUALS'
            )
        )
    )
)
WHERE name = 'columnValueMeanToBeBetween';

UPDATE test_definition
SET json = jsonb_set(
    jsonb_delete(json, '$.parameterDefinition'),
    '{parameterDefinition}',
    jsonb_build_array(
        jsonb_build_object(
            'name', 'minValueForMedianInCol',
            'dataType', 'INT',
            'required', false,
            'description', 'Expected median value for the column to be greater or equal than',
            'displayName', 'Min',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'maxValueForMedianInCol',
                'rule', 'LESS_THAN_OR_EQUALS'
            )
        ),
        jsonb_build_object(
            'name', 'maxValueForMedianInCol',
            'dataType', 'INT',
            'required', false,
            'description', 'Expected median value for the column to be lower or equal than',
            'displayName', 'Max',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'minValueForMedianInCol',
                'rule', 'GREATER_THAN_OR_EQUALS'
            )
        )
    )
)
WHERE name = 'columnValueMedianToBeBetween';

UPDATE test_definition
SET json = jsonb_set(
    jsonb_delete(json, '$.parameterDefinition'),
    '{parameterDefinition}',
    jsonb_build_array(
        jsonb_build_object(
            'name', 'minValueForMinInCol',
            'dataType', 'INT',
            'required', false,
            'description', 'Expected minimum value in the column to be greater or equal than',
            'displayName', 'Min',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'maxValueForMinInCol',
                'rule', 'LESS_THAN_OR_EQUALS'
            )
        ),
        jsonb_build_object(
            'name', 'maxValueForMinInCol',
            'dataType', 'INT',
            'required', false,
            'description', 'Expect minimum value in the column to be lower or equal than',
            'displayName', 'Max',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'minValueForMeanInCol',
                'rule', 'GREATER_THAN_OR_EQUALS'
            )
        )
    )
)
WHERE name = 'columnValueMinToBeBetween';

UPDATE test_definition
SET json = jsonb_set(
    jsonb_delete(json, '$.parameterDefinition'),
    '{parameterDefinition}',
    jsonb_build_array(
        jsonb_build_object(
            'name', 'minLength',
            'dataType', 'INT',
            'required', false,
            'description', 'The {minLength} for the column value. If minLength is not included, maxLength is treated as upperBound and there will be no minimum value length',
            'displayName', 'Min',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'maxLength',
                'rule', 'LESS_THAN_OR_EQUALS'
            )
        ),
        jsonb_build_object(
            'name', 'maxLength',
            'dataType', 'INT',
            'required', false,
            'description', 'The {maxLength} for the column value. if maxLength is not included, minLength is treated as lowerBound and there will be no maximum value length',
            'displayName', 'Max',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'minLength',
                'rule', 'GREATER_THAN_OR_EQUALS'
            )
        )
    )
)
WHERE name = 'columnValueLengthsToBeBetween';

UPDATE test_definition
SET json = jsonb_set(
    jsonb_delete(json, '$.parameterDefinition'),
    '{parameterDefinition}',
    jsonb_build_array(
        jsonb_build_object(
            'name', 'minValueForColSum',
            'dataType', 'INT',
            'required', false,
            'description', 'Expected sum of values in the column to be greater or equal than',
            'displayName', 'Min',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'maxValueForColSum',
                'rule', 'LESS_THAN_OR_EQUALS'
            )
        ),
        jsonb_build_object(
            'name', 'maxValueForColSum',
            'dataType', 'INT',
            'required', false,
            'description', 'Expected sum values in the column to be lower or equal than',
            'displayName', 'Max',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'minValueForColSum',
                'rule', 'GREATER_THAN_OR_EQUALS'
            )
        )
    )
)
WHERE name = 'columnValuesSumToBeBetween';

UPDATE test_definition
SET json = jsonb_set(
    jsonb_delete(json, '$.parameterDefinition'),
    '{parameterDefinition}',
    jsonb_build_array(
        jsonb_build_object(
            'name', 'minValueForStdDevInCol',
            'dataType', 'INT',
            'required', false,
            'description', 'Expected std. dev value for the column to be greater or equal than',
            'displayName', 'Min',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'maxValueForStdDevInCol',
                'rule', 'LESS_THAN_OR_EQUALS'
            )
        ),
        jsonb_build_object(
            'name', 'maxValueForStdDevInCol',
            'dataType', 'INT',
            'required', false,
            'description', 'Expected std. dev value for the column to be lower or equal than',
            'displayName', 'Max',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'minValueForStdDevInCol',
                'rule', 'GREATER_THAN_OR_EQUALS'
            )
        )
    )
)
WHERE name = 'columnValueStdDevToBeBetween';

UPDATE test_definition
SET json = jsonb_set(
    jsonb_delete(json, '$.parameterDefinition'),
    '{parameterDefinition}',
    jsonb_build_array(
        jsonb_build_object(
            'name', 'minColValue',
            'dataType', 'INT',
            'required', false,
            'description', 'Expected number of columns should be greater than or equal to {minValue}. If minValue is not included, maxValue is treated as upperBound and there will be no minimum number of column',
            'displayName', 'Min',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'maxColValue',
                'rule', 'LESS_THAN_OR_EQUALS'
            )
        ),
        jsonb_build_object(
            'name', 'maxColValue',
            'dataType', 'INT',
            'required', false,
            'description', 'Expected number of columns should be less than or equal to {maxValue}. If maxValue is not included, minValue is treated as lowerBound and there will be no maximum number of column',
            'displayName', 'Max',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'minColValue',
                'rule', 'GREATER_THAN_OR_EQUALS'
            )
        )
    )
)
WHERE name = 'tableColumnCountToBeBetween';

UPDATE test_definition
SET json = jsonb_set(
    jsonb_delete(json, '$.parameterDefinition'),
    '{parameterDefinition}',
    jsonb_build_array(
        jsonb_build_object(
            'name', 'minValue',
            'dataType', 'INT',
            'required', false,
            'description', 'Expected number of columns should be greater than or equal to {minValue}. If minValue is not included, maxValue is treated as upperBound and there will be no minimum',
            'displayName', 'Min',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'maxValue',
                'rule', 'LESS_THAN_OR_EQUALS'
            )
        ),
        jsonb_build_object(
            'name', 'maxValue',
            'dataType', 'INT',
            'required', false,
            'description', 'Expected number of columns should be less than or equal to {maxValue}. If maxValue is not included, minValue is treated as lowerBound and there will be no maximum',
            'displayName', 'Max',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'minValue',
                'rule', 'GREATER_THAN_OR_EQUALS'
            )
        )
    )
)
WHERE name = 'tableRowCountToBeBetween';

UPDATE test_definition
SET json = jsonb_set(
    jsonb_delete(json, '$.parameterDefinition'),
    '{parameterDefinition}',
    jsonb_build_array(
        jsonb_build_object(
            'name', 'min',
            'dataType', 'INT',
            'required', false,
            'description', 'Lower Bound of the Count',
            'displayName', 'Min Row Count',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'max',
                'rule', 'LESS_THAN_OR_EQUALS'
            )
        ),
        jsonb_build_object(
            'name', 'max',
            'dataType', 'INT',
            'required', false,
            'description', 'Upper Bound of the Count',
            'displayName', 'Max Row Count',
            'optionValues', '[]'::jsonb,
            'validationRule', jsonb_build_object(
                'parameterField', 'min',
                'rule', 'GREATER_THAN_OR_EQUALS'
            )
        )
    )
)
WHERE name = 'tableRowInsertedCountToBeBetween';
-- End of Test Definition Parameter Definition Validation Migration

-- Start of updating existing customLogoConfiguration config with new customUiThemePreference
UPDATE openmetadata_settings AS ui
SET json = jsonb_build_object(
    'customLogoConfig', jsonb_build_object(
        'customLogoUrlPath', logo.json -> 'customLogoUrlPath',
        'customFaviconUrlPath', logo.json -> 'customFaviconUrlPath',
        'customMonogramUrlPath', logo.json -> 'customMonogramUrlPath'
    ),
    'customTheme', jsonb_build_object(
        'primaryColor', '',
        'errorColor', '',
        'successColor', '',
        'warningColor', '',
        'infoColor', ''
    )
)
FROM openmetadata_settings AS logo
WHERE ui.configType = 'customUiThemePreference'
AND logo.configType = 'customLogoConfiguration';

DELETE from openmetadata_settings where configType = 'customLogoConfiguration';
-- End of updating  customUiThemePreference config