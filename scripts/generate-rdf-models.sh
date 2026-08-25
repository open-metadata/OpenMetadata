#!/bin/bash
#
# Script to generate RDF models from JSON schemas
# This creates JSON-LD contexts and OWL ontology from OpenMetadata schemas
#

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$SCRIPT_DIR/.."

SCHEMA_PATH="$ROOT_DIR/openmetadata-spec/src/main/resources/json/schema"
OUTPUT_PATH="$ROOT_DIR/openmetadata-spec/src/main/resources/rdf"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}OpenMetadata RDF Model Generator${NC}"
echo "=================================="

# Check if schema directory exists
if [ ! -d "$SCHEMA_PATH" ]; then
    echo -e "${RED}Error: Schema directory not found at $SCHEMA_PATH${NC}"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_PATH"

# Compile the generator if needed
echo -e "${YELLOW}Compiling RDF generator...${NC}"
cd "$ROOT_DIR"
mvn compile -pl openmetadata-service -DskipTests

# Run the generator
echo -e "${YELLOW}Generating RDF models...${NC}"
mvn exec:java \
    -pl openmetadata-service \
    -Dexec.mainClass="org.openmetadata.service.rdf.generator.RdfModelGenerator" \
    -Dexec.args="$SCHEMA_PATH $OUTPUT_PATH"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}RDF model generation completed successfully!${NC}"
    echo ""
    echo "Generated files:"
    echo "- JSON-LD contexts: $OUTPUT_PATH/contexts/"
    echo "- OWL ontology: $OUTPUT_PATH/ontology/openmetadata-generated.ttl"
else
    echo -e "${RED}RDF model generation failed!${NC}"
    exit 1
fi