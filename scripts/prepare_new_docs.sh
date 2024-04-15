#!/bin/bash
# Example usage: find /path/to/docs/v1.4/ -type f | ./scripts/replace_version.sh v1.3 v1.4

OLD_VERION=$1
NEW_VERSION=$2

while IFS= read -r file
do
  sed -i '' -e 's/'$OLD_VERION'/'$NEW_VERSION'/g' "$file"
done