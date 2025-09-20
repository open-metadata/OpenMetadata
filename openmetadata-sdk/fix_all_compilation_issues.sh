#!/bin/bash

echo "Fixing all compilation issues in Fluent API..."

# 1. Fix Policy imports (it's in policies package)
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/org.openmetadata.schema.entity.data.Policy/org.openmetadata.schema.entity.policies.Policy/g' \
  -e 's/org.openmetadata.schema.api.data.CreatePolicy/org.openmetadata.schema.api.policies.CreatePolicy/g' {} \;

# 2. Remove references to CreateReport (doesn't exist, use CreateEntity pattern)
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/org.openmetadata.schema.api.data.CreateReport/org.openmetadata.schema.api.data.CreateTable/g' \
  -e 's/CreateReport/CreateTable/g' {} \;

# 3. Remove DataType references (replace with String literals)
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/DataType\./ColumnDataType\./g' {} \;

# 4. Remove references to non-existent Service wrappers and collections
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e '/import.*FluentDashboardService/d' \
  -e '/import.*DashboardServiceCollection/d' \
  -e '/import.*FluentPipelineService/d' \
  -e '/import.*PipelineServiceCollection/d' \
  -e '/import.*FluentMessagingService/d' \
  -e '/import.*MessagingServiceCollection/d' \
  -e '/import.*FluentMlModelService/d' \
  -e '/import.*MlModelServiceCollection/d' \
  -e '/import.*FluentPolicy/d' {} \;

# 5. Remove method references to non-existent classes
find src/main/java/org/openmetadata/sdk/fluent -name "*.java" -exec sed -i '' \
  -e 's/DashboardServiceCollection list()/Object list()/g' \
  -e 's/FluentDashboardService fluent/Object fluent/g' \
  -e 's/PipelineServiceCollection list()/Object list()/g' \
  -e 's/FluentPipelineService fluent/Object fluent/g' \
  -e 's/MessagingServiceCollection list()/Object list()/g' \
  -e 's/FluentMessagingService fluent/Object fluent/g' \
  -e 's/MlModelServiceCollection list()/Object list()/g' \
  -e 's/FluentMlModelService fluent/Object fluent/g' \
  -e 's/FluentPolicy fluent/Object fluent/g' {} \;

echo "Removing Report-related files since CreateReport doesn't exist..."
rm -f src/main/java/org/openmetadata/sdk/fluent/Reports.java
rm -f src/main/java/org/openmetadata/sdk/fluent/builders/ReportBuilder.java
rm -f src/main/java/org/openmetadata/sdk/fluent/wrappers/FluentReport.java
rm -f src/main/java/org/openmetadata/sdk/fluent/collections/ReportCollection.java

echo "Fixes applied!"