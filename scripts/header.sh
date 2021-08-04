file=/home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/*.md
sed -i '1d' $file
cd /home/runner/work/OpenMetadata/OpenMetadata/docs/openmetadata-apis/schemas/SchemaMarkdown/
for file in *.md
do
  sed -i "1i\
# ${file%%.*}" "$file"
done

