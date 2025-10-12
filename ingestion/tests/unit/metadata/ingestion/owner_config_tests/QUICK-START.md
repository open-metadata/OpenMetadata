# Owner Configuration Tests - Quick Start Guide

## 🚀 Get Started in 5 Minutes

This guide helps you quickly set up and run the owner configuration tests.

---

## Prerequisites

- Docker and Docker Compose installed
- OpenMetadata instance running on `http://localhost:8585`
- Admin access to OpenMetadata

---

## Step 1: Start PostgreSQL Test Database

```bash
cd /workspace/ingestion/tests/unit/metadata/ingestion/owner_config_tests
docker-compose up -d
```

**What this does**: Creates 2 test databases (finance_db, marketing_db) with sample data.

**Verify it's running**:
```bash
docker ps | grep postgres
```

---
## Step 2: Get Your JWT Token

1. Log in to OpenMetadata UI
2. Go to **Settings → Bots** or **Settings → Personal Access Token**
3. Create a new token or copy existing one
4. Save it for the next step

---
## Step 3: Create Test Users and Teams in OpenMetadata

### Option A: Using Setup Script (Easiest ⭐)

```bash
cd /workspace/ingestion/tests/unit/metadata/ingestion/owner_config_tests

# Method 1: Set environment variable
export OPENMETADATA_JWT_TOKEN="your_jwt_token_here"
./setup-test-entities.sh

# Method 2: Pass as argument
./setup-test-entities.sh "your_jwt_token_here"
```

**Note**: Script is compatible with bash 3.2+ (macOS default version), no need to upgrade bash or install other shells.

The script will automatically create:
- **8 users**: alice, bob, charlie, david, emma, frank, marketing-user-1, marketing-user-2
- **11 teams**: 
  - data-platform-team (Data Platform)
  - finance-team (Finance)
  - marketing-team (Marketing)
  - accounting-team (Accounting)
  - treasury-team (Treasury)
  - expense-team (Expense)
  - revenue-team (Revenue)
  - investment-team (Investment)
  - treasury-ops-team (Treasury Operations)
  - audit-team (Audit)
  - compliance-team (Compliance)

**Output example**:
```
==========================================
OpenMetadata Test Entity Setup
==========================================
API URL: http://localhost:8585/api/v1
JWT Token: eyJraWQiOiJHYjM4OWEt...

Creating test users...
----------------------------------------
Creating user: alice ... ✓
Creating user: bob ... ✓
Creating user: charlie ... ✓
Creating user: david ... ✓
Creating user: emma ... ✓
Creating user: frank ... ✓
Creating user: marketing-user-1 ... ✓
Creating user: marketing-user-2 ... ✓

Users: 8/8 created/verified

Creating test teams...
----------------------------------------
Creating team: data-platform-team ... ✓
Creating team: finance-team ... ✓
Creating team: marketing-team ... ✓
Creating team: accounting-team ... ✓
Creating team: treasury-team ... ✓
Creating team: expense-team ... ✓
Creating team: revenue-team ... ✓
Creating team: investment-team ... ✓
Creating team: treasury-ops-team ... ✓
Creating team: audit-team ... ✓
Creating team: compliance-team ... ✓

Teams: 11/11 created/verified

==========================================
Setup Summary
==========================================
Users:  8/8
Teams:  11/11

✅ All entities created successfully!

Next steps:
  1. Update JWT tokens in test YAML files
  2. Run tests: cd /workspace/ingestion && metadata ingest -c tests/unit/metadata/ingestion/owner_config_tests/test-05-inheritance-enabled.yaml
```

### Option B: Manual API Calls

<details>
<summary>Click to expand manual API commands</summary>

```bash
# Set your JWT token
JWT_TOKEN="your_jwt_token_here"
API_URL="http://localhost:8585/api/v1"

# Create users
for user in alice bob charlie david emma frank marketing-user-1 marketing-user-2; do
  curl -X POST "${API_URL}/users" \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"${user}\", \"email\": \"${user}@example.com\"}"
done

# Create teams
for team in data-platform-team finance-team marketing-team accounting-team treasury-team expense-team revenue-team investment-team treasury-ops-team audit-team compliance-team; do
  curl -X POST "${API_URL}/teams" \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"${team}\", \"teamType\": \"Group\"}"
done
```
</details>

### Option C: Using OpenMetadata UI

If you prefer UI, go to `http://localhost:8585`:
1. **Settings → Users** - Create 8 users listed above
2. **Settings → Teams** - Create 11 teams listed above

### Verify Creation

```bash
API_URL="http://localhost:8585/api/v1"
JWT_TOKEN="your_jwt_token_here"

# List all users
curl -X GET "${API_URL}/users?limit=20" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq '.data[] | {name: .name, email: .email}'

# List all teams
curl -X GET "${API_URL}/teams?limit=20" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq '.data[] | {name: .name, teamType: .teamType}'
```

---
## Step 4: Update Test Configurations

Edit the JWT token in test files:

```bash
cd /workspace/ingestion/tests/unit/metadata/ingestion/owner_config_tests

# Replace JWT_TOKEN in all test files
for test in test-*.yaml; do
  sed -i '' 's/YOUR_JWT_TOKEN_HERE/your_actual_jwt_token_here/g' "$test"
done
```

Or manually edit each file and replace:
```yaml
jwtToken: "YOUR_JWT_TOKEN_HERE"
```

---

## Step 5: Prepare Environment

Before running tests, set up your Python environment:

### Activate Virtual Environment

```bash
# Navigate to OpenMetadata workspace root
cd ~/workspace/OpenMetadata

# Activate the virtual environment
source env/bin/activate
```

### Install Dependencies

If `metadata` command is not found:

```bash
cd ~/workspace/OpenMetadata/ingestion

# Install OpenMetadata ingestion package
pip install -e .

# Or install with specific connectors
pip install -e '.[postgres]'
```
---

## Step 6: Run Tests

**Important**: All commands assume you're in the workspace root directory (`/workspace/OpenMetadata`).

### Run a Single Test

Here's how to run one test to verify everything is working:

```bash
# Run Test 05 (Inheritance test - most critical)
metadata ingest -c ingestion/tests/unit/metadata/ingestion/owner_config_tests/test-05-inheritance-enabled.yaml
```

**What to look for:**
- ✅ Should complete without errors
- ✅ Child entities inherit parent owner (NOT default owner)
- ✅ Check OpenMetadata UI: `finance_db.accounting.revenue` should have owner "finance-team"

**Run with verbose logging** (for debugging):
```bash
metadata ingest -c ingestion/tests/unit/metadata/ingestion/owner_config_tests/test-05-inheritance-enabled.yaml --log-level DEBUG
```

---

### Run All Tests (Using Script)

Use the provided script to run all 8 tests automatically:

```bash
# Make sure you're in workspace root with virtual environment activated
# cd /workspace/OpenMetadata
# source env/bin/activate

# Run the test script
cd ./ingestion/tests/unit/metadata/ingestion/owner_config_tests
./run-all-tests.sh
```

**Note**: The script will automatically navigate to the correct workspace root directory.

**Output example:**
```
==========================================
Owner Configuration Tests - Run All
==========================================
Found 8 test files

[1/8] Running: test-01-basic-owner-config.yaml
✓ Test completed successfully

[2/8] Running: test-02-fqn-matching.yaml
✓ Test completed successfully

...

==========================================
Test Summary
==========================================
Total: 8
Passed: 8
Failed: 0

✅ All tests passed!
```

**Test Files (in order):**
1. test-01-basic-owner-config.yaml - Basic configuration
2. test-02-fqn-matching.yaml - FQN matching
3. test-03-multiple-users.yaml - Multiple users ⭐
4. test-04-validation-errors.yaml - Validation errors ⭐
5. test-05-inheritance-enabled.yaml - Inheritance enabled ⭐
6. test-06-inheritance-disabled.yaml - Inheritance disabled ⭐
7. test-07-partial-success.yaml - Partial success
8. test-08-integration-test.yaml - Integration test

**Critical tests** (⭐) verify the two main bug fixes.

---

## Step 7: Verify Results
Please check the results on the OpenMetaData web interface to see if it is consistent with expectations.

## Troubleshooting

### Issue: "declare: -A: invalid option" when running setup script
**Solution**: The script is now compatible with bash 3.2+. If you still see this error:
- Make sure you're using the latest version of `setup-test-entities.sh`
- The script uses regular arrays instead of associative arrays
- Works on macOS default bash without any upgrades

### Issue: Teams not created but users created successfully
**Solution**: 
- Check if there are any error messages after "Creating test teams..."
- Verify your JWT token has permission to create teams
- Try running the script with verbose output: `bash -x ./setup-test-entities.sh`
- Check OpenMetadata logs for team creation errors

### Issue: "Could not find owner"
**Solution**: Make sure all users/teams are created in Step 2.

### Issue: "Authentication failed"
**Solution**: Check your JWT token is valid and not expired.

### Issue: "Connection refused to PostgreSQL"
**Solution**: Verify PostgreSQL is running: `docker ps | grep postgres`

### Issue: Owner not assigned
**Solution**: 
- Verify `overrideMetadata: true` is set in YAML
- Check logs for validation errors
- Ensure owner exists in OpenMetadata

---

## Quick Test Matrix

| Test # | Focus | Expected Result |
|--------|-------|-----------------|
| 01 | Basic config | All levels assigned correctly |
| 02 | FQN matching | INFO logs for simple name fallback |
| 03 | Multiple users | 3 users assigned to revenue table |
| 04 | Validation | WARNING logs for invalid configs |
| 05 | Inheritance ON | Child inherits parent owner |
| 06 | Inheritance OFF | Child uses default (not inherited) |
| 07 | Partial success | Skip missing owners, continue | 
| 08 | Integration | All features work together | 

---

## Cleanup

When done testing:

```bash
# Stop and remove PostgreSQL
cd /workspace/ingestion/tests/unit/metadata/ingestion/owner_config_tests
docker-compose down -v

# Remove test entities from OpenMetadata (optional)
# Use UI or API to delete test users and teams
```

---

## Next Steps

- **For detailed information**: See `README.md` in this directory
- **For code details**: Check `ingestion/src/metadata/utils/owner_utils.py`
- **For schema spec**: Check `openmetadata-spec/.../type/ownerConfig.json`

---

## Quick Reference: Business Rules

✅ **Multiple users allowed**: `["alice", "bob", "charlie"]`  
✅ **Only ONE team allowed**: `"sales-team"` (string, not array)  
❌ **Users and teams mutually exclusive**: Cannot mix `["alice", "team1"]`

**Priority**: Specific Config > Inherited Owner > Default
