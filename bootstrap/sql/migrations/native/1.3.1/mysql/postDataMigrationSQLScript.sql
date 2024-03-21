-- Update the relation between testDefinition and testCase to 0 (CONTAINS)
UPDATE entity_relationship
SET relation = 0
WHERE fromEntity = 'testDefinition' AND toEntity = 'testCase' AND relation != 0;

-- Update the test definition provider
-- If the test definition has OpenMetadata as a test platform, then the provider is system, else it is user
UPDATE test_definition
SET json = CASE
		WHEN JSON_CONTAINS(json, '"OpenMetadata"', '$.testPlatforms') THEN JSON_INSERT(json,'$.provider','system')
		ELSE JSON_INSERT(json,'$.provider','user')
	END
;
