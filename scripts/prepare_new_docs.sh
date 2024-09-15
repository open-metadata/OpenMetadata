#!/bin/bash
# Example usage: ./scripts/prepare_new_docs v1.3 v1.4

OLD_VERION=$1
NEW_VERSION=$2

function replace_version {
  while IFS= read -r file
  do
    sed -i '' -e 's/'$OLD_VERION'/'$NEW_VERSION'/g' "$file"
  done
}

find openmetadata-docs/content/"$2.x"/ -type f | replace_version $1 $2
