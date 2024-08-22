-- Start of Test Definition Parameter Definition Validation Migration
UPDATE test_definition
set json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
		  'name', 'minValue',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'The {minValue} value for the column entry. If minValue is not included, maxValue is treated as upperBound and there will be no minimum',
	      'displayName', 'Min',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'maxValue',
        	'rule', 'LESS_THAN_OR_EQUALS'
	      )
		),
		JSON_OBJECT(
		  'name', 'maxValue',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'The {maxValue} value for the column entry. if maxValue is not included, minValue is treated as lowerBound and there will be no maximum',
	      'displayName', 'Max',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'minValue',
        	'rule', 'GREATER_THAN_OR_EQUALS'
	      )
		)
	)
)
WHERE name = 'columnValuesToBeBetween';

UPDATE test_definition
set json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
	      'name', 'minValueForMaxInCol',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expected minimum value in the column to be greater or equal than',
	      'displayName', 'Min',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'maxValueForMaxInCol',
        	'rule', 'LESS_THAN_OR_EQUALS'
	      )
		),
		JSON_OBJECT(
	      'name', 'maxValueForMaxInCol',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expected maximum value in the column to be lower or equal than',
	      'displayName', 'Max',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'minValueForMaxInCol',
        	'rule', 'GREATER_THAN_OR_EQUALS'
	      )
		)
	)
)
WHERE name = 'columnValueMaxToBeBetween';

UPDATE test_definition
set json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
	      'name', 'minValueForMeanInCol',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expected mean value for the column to be greater or equal than',
	      'displayName', 'Min',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'maxValueForMeanInCol',
        	'rule', 'LESS_THAN_OR_EQUALS'
	      )
		),
		JSON_OBJECT(
	      'name', 'maxValueForMeanInCol',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expected mean value for the column to be lower or equal than',
	      'displayName', 'Max',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'minValueForMeanInCol',
        	'rule', 'GREATER_THAN_OR_EQUALS'
	      )
		)
	)
)
WHERE name = 'columnValueMeanToBeBetween';

UPDATE test_definition
set json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
	      'name', 'minValueForMedianInCol',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expected median value for the column to be greater or equal than',
	      'displayName', 'Min',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'maxValueForMedianInCol',
        	'rule', 'LESS_THAN_OR_EQUALS'
	      )
		),
		JSON_OBJECT(
	      'name', 'maxValueForMedianInCol',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expected median value for the column to be lower or equal than',
	      'displayName', 'Max',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'minValueForMedianInCol',
        	'rule', 'GREATER_THAN_OR_EQUALS'
	      )
		)
	)
)
WHERE name = 'columnValueMedianToBeBetween';

UPDATE test_definition
set json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
	      'name', 'minValueForMinInCol',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expected minimum value in the column to be greater or equal than',
	      'displayName', 'Min',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'maxValueForMinInCol',
        	'rule', 'LESS_THAN_OR_EQUALS'
	      )
		),
		JSON_OBJECT(
	      'name', 'maxValueForMinInCol',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expect minimum value in the column to be lower or equal than',
	      'displayName', 'Max',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'minValueForMeanInCol',
        	'rule', 'GREATER_THAN_OR_EQUALS'
	      )
		)
	)
)
WHERE name = 'columnValueMinToBeBetween';

UPDATE test_definition
set json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
	      'name', 'minLength',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'The {minLength} for the column value. If minLength is not included, maxLength is treated as upperBound and there will be no minimum value length',
	      'displayName', 'Min',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'maxLength',
        	'rule', 'LESS_THAN_OR_EQUALS'
	      )
		),
		JSON_OBJECT(
	      'name', 'maxLength',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'The {maxLength} for the column value. if maxLength is not included, minLength is treated as lowerBound and there will be no maximum value length',
	      'displayName', 'Max',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'minLength',
        	'rule', 'GREATER_THAN_OR_EQUALS'
	      )
		)
	)
)
WHERE name = 'columnValueLengthsToBeBetween';

UPDATE test_definition
set json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
	      'name', 'minValueForColSum',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expected sum of values in the column to be greater or equal than',
	      'displayName', 'Min',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'maxValueForColSum',
        	'rule', 'LESS_THAN_OR_EQUALS'
	      )
		),
		JSON_OBJECT(
	      'name', 'maxValueForColSum',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expected sum values in the column to be lower or equal than',
	      'displayName', 'Max',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'minValueForColSum',
        	'rule', 'GREATER_THAN_OR_EQUALS'
	      )
		)
	)
)
WHERE name = 'columnValuesSumToBeBetween';

UPDATE test_definition
set json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
	      'name', 'minValueForStdDevInCol',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expected std. dev value for the column to be greater or equal than',
	      'displayName', 'Min',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'maxValueForStdDevInCol',
        	'rule', 'LESS_THAN_OR_EQUALS'
	      )
		),
		JSON_OBJECT(
	      'name', 'maxValueForStdDevInCol',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expected std. dev value for the column to be lower or equal than',
	      'displayName', 'Max',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'minValueForStdDevInCol',
        	'rule', 'GREATER_THAN_OR_EQUALS'
	      )
		)
	)
)
WHERE name = 'columnValueStdDevToBeBetween';

UPDATE test_definition
set json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
	      'name', 'minColValue',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expected number of columns should be greater than or equal to {minValue}. If minValue is not included, maxValue is treated as upperBound and there will be no minimum number of column',
	      'displayName', 'Min',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'maxColValue',
        	'rule', 'LESS_THAN_OR_EQUALS'
	      )
		),
		JSON_OBJECT(
	      'name', 'maxColValue',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expected number of columns should be less than or equal to {maxValue}. If maxValue is not included, minValue is treated as lowerBound and there will be no maximum number of column',
	      'displayName', 'Max',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'minColValue',
        	'rule', 'GREATER_THAN_OR_EQUALS'
	      )
		)
	)
)
WHERE name = 'tableColumnCountToBeBetween';

UPDATE test_definition
set json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
	      'name', 'minValue',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expected number of columns should be greater than or equal to {minValue}. If minValue is not included, maxValue is treated as upperBound and there will be no minimum',
	      'displayName', 'Min',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'maxValue',
        	'rule', 'LESS_THAN_OR_EQUALS'
	      )
		),
		JSON_OBJECT(
	      'name', 'maxValue',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Expected number of columns should be less than or equal to {maxValue}. If maxValue is not included, minValue is treated as lowerBound and there will be no maximum',
	      'displayName', 'Max',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'minValue',
        	'rule', 'GREATER_THAN_OR_EQUALS'
	      )
		)
	)
)
WHERE name = 'tableRowCountToBeBetween';

UPDATE test_definition
set json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
	      'name', 'min',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Lower Bound of the Count',
	      'displayName', 'Min Row Count',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
	      	'parameterField', 'max',
        	'rule', 'LESS_THAN_OR_EQUALS'
	      )
		),
		JSON_OBJECT(
	      'name', 'max',
	      'dataType', 'INT',
	      'required', false,
	      'description', 'Upper Bound of the Count',
	      'displayName', 'Max Row Count',
	      'optionValues', JSON_ARRAY(),
	      'validationRule', JSON_OBJECT(
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
JOIN openmetadata_settings AS logo
ON ui.configType = 'customUiThemePreference' AND logo.configType = 'customLogoConfiguration'
SET
  ui.json = JSON_OBJECT(
  'customLogoConfig', JSON_OBJECT(
      'customLogoUrlPath', JSON_UNQUOTE(JSON_EXTRACT(logo.json, '$.customLogoUrlPath')),
      'customFaviconUrlPath', JSON_UNQUOTE(JSON_EXTRACT(logo.json, '$.customFaviconUrlPath')),
      'customMonogramUrlPath', JSON_UNQUOTE(JSON_EXTRACT(logo.json, '$.customMonogramUrlPath'))
    ),
    'customTheme', JSON_OBJECT(
    	'primaryColor', '',
    	'errorColor', '',
    	'successColor', '',
      'warningColor', '',
      'infoColor', ''
    )
  )
WHERE ui.configType = 'customUiThemePreference';

DELETE from openmetadata_settings where configType = 'customLogoConfiguration';
-- End of updating  customUiThemePreference config