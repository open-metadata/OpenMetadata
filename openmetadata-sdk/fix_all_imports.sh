#!/bin/bash

echo "Fixing all import issues..."

# Fix Classification imports (should be in classification package)
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/org.openmetadata.schema.entity.data.Classification/org.openmetadata.schema.entity.classification.Classification/g' \
  -e 's/org.openmetadata.schema.api.data.CreateClassification/org.openmetadata.schema.api.classification.CreateClassification/g' {} \;

# Fix Tag imports
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/org.openmetadata.schema.entity.classification.Tag/org.openmetadata.schema.entity.classification.Tag/g' \
  -e 's/org.openmetadata.schema.api.classification.CreateTag/org.openmetadata.schema.api.classification.CreateTag/g' {} \;

# Fix User/Team imports (they're in teams package)
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/org.openmetadata.schema.entity.data.User/org.openmetadata.schema.entity.teams.User/g' \
  -e 's/org.openmetadata.schema.entity.data.Team/org.openmetadata.schema.entity.teams.Team/g' \
  -e 's/org.openmetadata.schema.api.data.CreateUser/org.openmetadata.schema.api.teams.CreateUser/g' \
  -e 's/org.openmetadata.schema.api.data.CreateTeam/org.openmetadata.schema.api.teams.CreateTeam/g' {} \;

# Fix Role imports
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/org.openmetadata.schema.entity.teams.Role/org.openmetadata.schema.entity.teams.Role/g' \
  -e 's/org.openmetadata.schema.api.teams.CreateRole/org.openmetadata.schema.api.teams.CreateRole/g' {} \;

# Fix DatabaseConnection to proper type
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/DatabaseConnection/Object/g' {} \;

# Remove DataType references entirely (doesn't exist)
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/String\./ColumnDataType\./g' {} \;

# Remove non-existent wrappers
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e '/FluentTestDefinition/d' \
  -e '/FluentRole/d' \
  -e '/FluentStorageService/d' \
  -e '/StorageServiceCollection/d' {} \;

echo "Fixes applied!"
