#!/bin/bash
# Simple script to clean up test glossary

TOKEN="$1"
GLOSSARY_NAME="${2:-LargeTestGlossary}"
SERVER_URL="${3:-http://localhost:8585}"

if [ -z "$TOKEN" ]; then
    echo "Usage: $0 <token> [glossary_name] [server_url]"
    exit 1
fi

# Get glossary details
echo "Checking if glossary '$GLOSSARY_NAME' exists..."
GLOSSARY_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$SERVER_URL/api/v1/glossaries/name/$GLOSSARY_NAME")

if [ $? -eq 0 ] && echo "$GLOSSARY_RESPONSE" | grep -q '"id"'; then
    GLOSSARY_ID=$(echo "$GLOSSARY_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    echo "Found glossary with ID: $GLOSSARY_ID"
    
    # Delete glossary
    echo "Deleting glossary and all its terms..."
    DELETE_RESPONSE=$(curl -s -X DELETE \
        -H "Authorization: Bearer $TOKEN" \
        "$SERVER_URL/api/v1/glossaries/$GLOSSARY_ID?recursive=true&hardDelete=true")
    
    if [ $? -eq 0 ]; then
        echo "Successfully deleted glossary '$GLOSSARY_NAME'"
    else
        echo "Failed to delete glossary"
    fi
else
    echo "Glossary '$GLOSSARY_NAME' not found"
fi