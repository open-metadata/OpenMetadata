echo "------------------Merging Files------------------"
cd docs/openmetadata-apis/schemas/SchemaMarkdown
cat bots-* >> bots.md
cat dashboard-* >> dashboard.md
cat database-* >> database.md
cat databaseservice-* >> databaseservice.md
cat thread-* >> thread.md
cat metrics-* >> metrics.md
cat pipeline-* >> pipeline.md
cat report-* >> report.md
cat table-* >> table.md
cat tagcategory-* >> tagcategory.md
cat team-* >> team.md
cat user-* >> user.md
cat basic-* >> basic.md
cat collectiondescriptor-* >> collectiondescriptor.md
cat dailycount-* >> dailycount.md
cat entityreference-* >> entityreference.md
cat entityusage-* >> entityusage.md
cat jdbcconnection-* >> jdbcconnection.md
cat profile-* >> profile.md
cat schedule-* >> schedule.md
cat taglabel-* >> taglabel.md
cat usagedetails-* >> usagedetails.md
echo "------------------Files Merged------------------"

echo "------------------Moving files------------------"
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/bots.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/entities
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/dashboard.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/entities
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/database.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/entities
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/databaseservice.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/entities
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/thread.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/entities
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/metrics.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/entities
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/pipeline.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/entities
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/report.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/entities
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/table.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/entities
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/tagcategory.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/entities
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/team.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/entities
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/user.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/entities
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/basic.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/types
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/collectiondescriptor.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/types
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/dailycount.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/types
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/entityreference.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/types
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/entityusage.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/types
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/jdbcconnection.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/types
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/profile.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/types
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/schedule.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/types
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/taglabel.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/types
cp /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/usagedetails.md /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/types
echo "------------------Files moved to respective folders------------------"
