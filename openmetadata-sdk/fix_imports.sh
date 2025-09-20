#!/bin/bash

# Fix imports for entities in the fluent API

echo "Fixing import issues in generated Fluent API..."

# Fix Domain imports
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/org.openmetadata.schema.api.data.CreateDomain/org.openmetadata.schema.api.domains.CreateDomain/g' \
  -e 's/org.openmetadata.schema.entity.data.Domain/org.openmetadata.schema.entity.domains.Domain/g' {} \;

# Fix DataProduct imports
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/org.openmetadata.schema.api.data.CreateDataProduct/org.openmetadata.schema.api.domains.CreateDataProduct/g' \
  -e 's/org.openmetadata.schema.entity.data.DataProduct/org.openmetadata.schema.entity.domains.DataProduct/g' {} \;

# Fix Bot imports
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/org.openmetadata.schema.api.bots/org.openmetadata.schema.api.teams/g' \
  -e 's/org.openmetadata.schema.entity.bots/org.openmetadata.schema.entity.teams/g' {} \;

# Fix Classification imports
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/org.openmetadata.schema.entity.classification.Classification/org.openmetadata.schema.entity.classification.Classification/g' \
  -e 's/org.openmetadata.schema.entity.classification.Tag/org.openmetadata.schema.entity.classification.Tag/g' {} \;

# Fix Tag imports (Tags are in classification package)
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/org.openmetadata.schema.entity.data.Tag/org.openmetadata.schema.entity.classification.Tag/g' \
  -e 's/org.openmetadata.schema.api.data.CreateTag/org.openmetadata.schema.api.classification.CreateTag/g' {} \;

# Fix Role imports (Roles are in teams package)
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/org.openmetadata.schema.entity.data.Role/org.openmetadata.schema.entity.teams.Role/g' \
  -e 's/org.openmetadata.schema.api.data.CreateRole/org.openmetadata.schema.api.teams.CreateRole/g' {} \;

# Fix Policy imports
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/org.openmetadata.schema.entity.policies/org.openmetadata.schema.entity.policies/g' \
  -e 's/org.openmetadata.schema.api.policies/org.openmetadata.schema.api.policies/g' {} \;

# Fix TestCase, TestDefinition, TestSuite imports
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/org.openmetadata.schema.entity.dataQuality/org.openmetadata.schema.tests/g' \
  -e 's/org.openmetadata.schema.api.dataQuality/org.openmetadata.schema.api.tests/g' {} \;

# Fix Report imports (Reports might not exist)
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/org.openmetadata.schema.entity.data.Report/org.openmetadata.schema.entity.data.Report/g' \
  -e 's/org.openmetadata.schema.api.data.CreateReport/org.openmetadata.schema.api.data.CreateReport/g' {} \;

# Remove non-existent imports
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e '/import org.openmetadata.sdk.fluent.options/d' \
  -e '/import org.openmetadata.schema.type.DataType/d' \
  -e '/import org.openmetadata.sdk.fluent.wrappers.FluentBot/d' \
  -e '/import org.openmetadata.sdk.fluent.wrappers.FluentRole/d' \
  -e '/import org.openmetadata.sdk.fluent.wrappers.FluentStorageService/d' \
  -e '/import org.openmetadata.sdk.fluent.collections.StorageServiceCollection/d' {} \;

# Remove references to non-existent classes in code
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/RequestOptions/Object/g' \
  -e 's/DataType\./String./g' {} \;

echo "Import fixes applied!"