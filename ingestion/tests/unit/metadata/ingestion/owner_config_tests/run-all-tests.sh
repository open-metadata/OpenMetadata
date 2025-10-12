#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
#
# Run all owner configuration tests
# This script runs all test-*.yaml files in order and reports results
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if we're in the correct directory
# We should be in owner_config_tests directory
if [[ ! -f "$SCRIPT_DIR/setup-test-entities.sh" ]]; then
    echo -e "${RED}❌ Error: Script must be run from owner_config_tests directory${NC}"
    exit 1
fi

# Navigate to workspace root (6 levels up from owner_config_tests)
# owner_config_tests -> ingestion -> metadata -> unit -> tests -> ingestion -> OpenMetadata
cd "$SCRIPT_DIR/../../../../.."
WORKSPACE_ROOT="$(pwd)"

echo "=========================================="
echo "Owner Configuration Tests - Run All"
echo "=========================================="
echo "Workspace: $WORKSPACE_ROOT"
echo ""

# Find all test YAML files
TEST_FILES=($SCRIPT_DIR/test-*.yaml)
TOTAL_TESTS=${#TEST_FILES[@]}

if [ $TOTAL_TESTS -eq 0 ]; then
    echo -e "${RED}❌ No test files found${NC}"
    exit 1
fi

echo "Found $TOTAL_TESTS test files"
echo ""

# Check if metadata command exists
if ! command -v metadata &> /dev/null; then
    echo -e "${RED}❌ Error: 'metadata' command not found${NC}"
    echo ""
    echo "Please activate your virtual environment first:"
    echo "  source env/bin/activate"
    echo ""
    echo "Or install OpenMetadata:"
    echo "  cd ingestion && pip install -e ."
    exit 1
fi

# Test counters
PASSED=0
FAILED=0
FAILED_TESTS=()

# Run each test
for i in "${!TEST_FILES[@]}"; do
    TEST_FILE="${TEST_FILES[$i]}"
    TEST_NAME=$(basename "$TEST_FILE")
    TEST_NUM=$((i + 1))
    
    # Get relative path from workspace root
    REL_PATH="ingestion/tests/unit/metadata/ingestion/owner_config_tests/$TEST_NAME"
    
    echo -e "${BLUE}[$TEST_NUM/$TOTAL_TESTS]${NC} Running: ${TEST_NAME}"
    
    # Run the test and capture output
    if metadata ingest -c "$REL_PATH" > /tmp/test_output_$$.log 2>&1; then
        echo -e "       ${GREEN}✓${NC} Test completed successfully"
        ((PASSED++))
    else
        echo -e "       ${RED}✗${NC} Test failed"
        ((FAILED++))
        FAILED_TESTS+=("$TEST_NAME")
        
        # Show last few lines of error
        echo -e "${YELLOW}       Last error lines:${NC}"
        tail -3 /tmp/test_output_$$.log | sed 's/^/       /'
    fi
    
    # Clean up temp log
    rm -f /tmp/test_output_$$.log
    echo ""
done

# Print summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Total:  $TOTAL_TESTS"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "Failed: ${RED}${FAILED}${NC}"
else
    echo -e "Failed: ${FAILED}"
fi
echo ""

# List failed tests if any
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed tests:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo "  - $test"
    done
    echo ""
    echo -e "${YELLOW}⚠ Some tests failed. Check the output above for details.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Verify results in OpenMetadata UI (http://localhost:8585)"
    echo "  2. Check Explore → Databases for owner assignments"
    echo "  3. Review test logs for any validation warnings"
    exit 0
fi

