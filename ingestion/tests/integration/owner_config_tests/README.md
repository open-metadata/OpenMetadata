# Owner Configuration Feature - Comprehensive Guide

## Overview

The Owner Configuration feature allows you to automatically assign owners to metadata entities (databases, schemas, tables) during ingestion based on flexible, hierarchical rules. This guide covers the complete functionality, business rules, and implementation details.

## Table of Contents

1. [Business Rules](#business-rules)
2. [Configuration Structure](#configuration-structure)
3. [Resolution Priority](#resolution-priority)
4. [Feature Details](#feature-details)
5. [Test Suite](#test-suite)
6. [Implementation Details](#implementation-details)
7. [Examples](#examples)

---

## Business Rules

### Owner Type Constraints

The system enforces strict rules about owner types to maintain data consistency:

#### ✅ Rule 1: Multiple Users Allowed
You can assign multiple users as owners of an entity:
```yaml
database:
  "sales_db": ["alice", "bob", "charlie"]
```
- All owners must be users (type="user")
- No limit on number of users
- Each user must exist in OpenMetadata

#### ✅ Rule 2: Only ONE Team Allowed
You can only assign a single team as owner:
```yaml
database:
  "sales_db": "sales-team"  # ✅ Correct (string)
  "marketing_db": ["marketing-team"]  # ⚠️ Works but deprecated (use string)
  "finance_db": ["team1", "team2", "team3"]  # ❌ Invalid (multiple teams)
```
- Only one team per entity
- Use string format, not array
- If array with multiple teams: logs WARNING and uses first team only

#### ❌ Rule 3: Users and Teams are Mutually Exclusive
You cannot mix users and teams in the same owner list:
```yaml
table:
  "orders": ["alice", "bob", "sales-team"]  # ❌ Invalid (mixed types)
```
- If mixed: logs WARNING and skips the configuration
- Entity will fallback to inherited owner or default

---
## Configuration Structure

### Basic Syntax

```yaml
ownerConfig:
  default: "fallback-owner"           # Applied when no other rule matches
  enableInheritance: true             # Default: true
  
  database: "db-owner"                # All databases get this owner
  # OR
  database:                           # Specific databases get specific owners
    "sales_db": "sales-team"
    "analytics_db": ["data-user-1", "data-user-2"]
  
  databaseSchema:                     # Schema-level configuration
    "sales_db.public": "public-team"  # FQN exact match
    "reporting": "reporting-team"     # Simple name match (fallback)
  
  table:                              # Table-level configuration
    "sales_db.public.orders": ["alice", "bob"]
    "customers": "customer-team"
```

### Configuration Formats

#### Format 1: String (Simple)
Applies the same owner to all entities at that level:
```yaml
database: "database-admins"
databaseSchema: "schema-owners"
table: "table-stewards"
```

#### Format 2: Dictionary (Specific)
Maps specific entities to specific owners:
```yaml
database:
  "sales_db": "sales-team"
  "analytics_db": "analytics-team"
```

#### Format 3: Mixed (Flexible)
Combines specific and general rules:
```yaml
database: "default-db-owner"          # General rule
databaseSchema:                       # Specific rules
  "sales_db.public": "public-team"
  "analytics_db.reporting": ["user1", "user2"]
```

---

## Resolution Priority

The system follows a strict priority order when resolving owners:

### Priority Order (Highest to Lowest)

1. **Specific Configuration - FQN Exact Match**
   ```yaml
   table:
     "sales_db.public.orders": "sales-team"
   ```
   - Matches full entity name exactly
   - Highest priority

2. **Specific Configuration - Simple Name Match**
   ```yaml
   table:
     "orders": "sales-team"
   ```
   - Matches last segment of entity name
   - Logs INFO: "FQN match failed, matched using simple name"

3. **Level Configuration - String Format**
   ```yaml
   table: "table-stewards"
   ```
   - Applies to all entities at this level

4. **Inherited Owner** (if `enableInheritance: true`)
   - Child inherits from parent entity
   - Example: Table inherits from schema, schema from database

5. **Default Configuration**
   ```yaml
   default: "data-platform-team"
   ```
   - Last resort fallback

### Example Priority Resolution

Given this configuration:
```yaml
ownerConfig:
  default: "data-platform-team"
  enableInheritance: true
  database:
    "sales_db": "sales-team"
  table:
    "orders": "order-team"
```

Resolution for different entities:
- `sales_db` → "sales-team" (specific config)
- `sales_db.public` → "sales-team" (inherited from database)
- `sales_db.public.orders` → "order-team" (specific config)
- `sales_db.public.customers` → "sales-team" (inherited from database)
- `marketing_db` → "data-platform-team" (default)

---

## Feature Details

### 1. Inheritance Mechanism

#### When Enabled (`enableInheritance: true`, default)
Child entities inherit owner from parent when no specific configuration exists:

```yaml
ownerConfig:
  default: "data-platform-team"
  enableInheritance: true
  database:
    "sales_db": "sales-team"
```

**Result**:
- `sales_db` → "sales-team" (specific)
- `sales_db.public` → "sales-team" (**inherited** from database)
- `sales_db.public.orders` → "sales-team" (**inherited** from schema)

#### When Disabled (`enableInheritance: false`)
Child entities use default owner instead of inheriting:

```yaml
ownerConfig:
  default: "data-platform-team"
  enableInheritance: false
  database:
    "sales_db": "sales-team"
```

**Result**:
- `sales_db` → "sales-team" (specific)
- `sales_db.public` → "data-platform-team" (**default**, not inherited)
- `sales_db.public.orders` → "data-platform-team" (**default**, not inherited)

### 2. FQN vs Simple Name Matching

#### FQN (Fully Qualified Name) Matching - Recommended
Provides precise control:
```yaml
databaseSchema:
  "sales_db.public": "public-team"
  "sales_db.staging": "staging-team"
```

#### Simple Name Matching - Fallback
When FQN doesn't match, tries simple name:
```yaml
table:
  "orders": "order-team"
```

This matches:
- `sales_db.public.orders` ✅
- `analytics_db.staging.orders` ✅
- Any table named "orders" ✅

**Log Output**:
```
INFO: FQN match failed for 'sales_db.public.orders', matched using simple name 'orders'
```

### 3. Owner Type Validation

#### Multiple Users (Valid)
```yaml
table:
  "revenue": ["alice", "bob", "charlie"]
```
**Behavior**: All users assigned successfully
**Requirement**: All must be users (type="user")

#### Multiple Teams (Invalid)
```yaml
database:
  "sales_db": ["sales-team", "finance-team", "audit-team"]
```
**Behavior**: 
- Logs WARNING: "Only ONE team allowed, using first team"
- Assigns only "sales-team"

#### Mixed Types (Invalid)
```yaml
table:
  "orders": ["alice", "bob", "sales-team"]
```
**Behavior**:
- Logs WARNING: "Cannot mix users and teams"
- Skips configuration, uses inherited owner or default

### 4. Partial Success Strategy

When some owners don't exist:
```yaml
table:
  "revenue": ["alice", "nonexistent-user-1", "bob", "nonexistent-user-2"]
```

**Behavior**:
- Assigns "alice" and "bob" successfully ✅
- Logs WARNING: "Could not find owner: nonexistent-user-1"
- Logs WARNING: "Could not find owner: nonexistent-user-2"
- Continues ingestion (doesn't fail)

### 5. Email-based Lookup

You can use email addresses for owner lookup:
```yaml
default: "admin@company.com"
table:
  "sensitive_data": ["alice@company.com", "bob@company.com"]
```

System tries:
1. Lookup by name first
2. If not found and contains "@", lookup by email

---

## Test Suite

### Purpose

This test suite validates all owner configuration features with 8 focused test scenarios.

### Test Scenarios

| # | Name | Validates |
|---|------|-----------|
| 01 | Basic Configuration | Default + hierarchical owner assignment |
| 02 | FQN Matching | FQN exact match vs simple name fallback |
| 03 | Multiple Users | Multiple users as owners (valid) |
| 04 | Validation Errors | Owner type constraint violations |
| 05 | Inheritance Enabled | Inheritance mechanism ⭐ |
| 06 | Inheritance Disabled | Disabled inheritance behavior |
| 07 | Partial Success | Resilience to missing owners |
| 08 | Complex Mixed | All features combined |

⭐ = Critical test for bug verification

### Quick Start

For step-by-step setup and running tests, see **[QUICK-START.md](QUICK-START.md)**

**TL;DR**: Use the provided setup script to create all test entities:
```bash
cd ingestion/tests/integration/owner_config_tests
export OPENMETADATA_JWT_TOKEN="your_token"
./setup-test-entities.sh
```

### Test Database Structure

**finance_db**:
- accounting schema: revenue, expenses, budgets tables + monthly_summary view
- treasury schema: cash_flow, investments, forecasts tables

**marketing_db**:
- campaigns schema: email_campaigns, social_media, social_ads tables
- analytics schema: customer_segments, conversion_funnel, web_traffic tables + campaign_performance view

**Total**: 2 databases, 4 schemas, 11 tables, 2 views

---

## Implementation Details

### Code Location

**Core Logic**: `ingestion/src/metadata/utils/owner_utils.py`

#### Key Classes and Methods

**`OwnerResolver` class**:
- `__init__(metadata, owner_config)` - Initialize with OpenMetadata client and config
- `resolve_owner(entity_type, entity_name, parent_owner)` - Main resolution logic
- `_get_owner_refs(owner_names)` - Owner lookup and validation

#### Resolution Logic Flow

```python
def resolve_owner(entity_type, entity_name, parent_owner):
    # 1. Check specific configuration (FQN match)
    if entity_name in level_config:
        return get_owner_refs(level_config[entity_name])
    
    # 2. Check specific configuration (simple name match)
    simple_name = entity_name.split(".")[-1]
    if simple_name in level_config:
        logger.info("FQN match failed, using simple name")
        return get_owner_refs(level_config[simple_name])
    
    # 3. Check level string configuration
    if isinstance(level_config, str):
        return get_owner_refs(level_config)
    
    # 4. Try inheritance
    if enable_inheritance and parent_owner:
        logger.debug("Using inherited owner")
        return get_owner_refs(parent_owner)
    
    # 5. Use default
    if default_owner:
        logger.debug("Using default owner")
        return get_owner_refs(default_owner)
    
    return None
```

#### Validation Logic

```python
def _get_owner_refs(owner_names):
    all_owners = []
    owner_types = set()  # Track 'user' or 'team'
    
    # Collect all owners and their types
    for name in owner_names:
        owner = lookup_owner(name)
        all_owners.append(owner)
        owner_types.add(owner.type)
    
    # VALIDATION 1: Cannot mix users and teams
    if len(owner_types) > 1:
        logger.warning("Cannot mix users and teams")
        return None
    
    # VALIDATION 2: Only one team allowed
    if "team" in owner_types and len(all_owners) > 1:
        logger.warning("Only ONE team allowed, using first")
        return [all_owners[0]]
    
    return all_owners
```

### JSON Schema Location

**Schema Definition**: `openmetadata-spec/src/main/resources/json/schema/type/ownerConfig.json`

Key properties:
- `default` (string): Fallback owner
- `database`, `databaseSchema`, `table` (string | object): Level configurations
- `enableInheritance` (boolean): Enable/disable inheritance

### Logging Levels

**DEBUG**: Normal operation details
```
Resolving owner for table 'revenue'
Found owner: alice (type: user)
Using inherited owner: finance-team
```

**INFO**: Notable events (simple name fallback)
```
FQN match failed for 'finance_db.treasury', matched using simple name 'treasury'
```

**WARNING**: Validation failures, missing owners
```
VALIDATION ERROR: Only ONE team allowed as owner, but got 3 teams
Could not find owner: nonexistent-user-1
```

**ERROR**: Critical failures
```
Error resolving owner for table 'revenue': <exception details>
```

---

## Examples

### Example 1: Simple Default Owner

**Use Case**: All entities should have the same owner

```yaml
ownerConfig:
  default: "data-engineering-team"
```

**Result**: Every database, schema, and table gets "data-engineering-team"

---

### Example 2: Database-Level Owners

**Use Case**: Different teams own different databases

```yaml
ownerConfig:
  default: "data-platform-team"
  database:
    "sales_db": "sales-team"
    "finance_db": "finance-team"
    "analytics_db": "analytics-team"
  enableInheritance: true
```

**Result**:
- `sales_db` and all its schemas/tables → "sales-team"
- `finance_db` and all its schemas/tables → "finance-team"
- `analytics_db` and all its schemas/tables → "analytics-team"
- Other databases → "data-platform-team"

---

### Example 3: Schema-Level Granularity

**Use Case**: Different schemas within a database have different owners

```yaml
ownerConfig:
  default: "data-platform-team"
  database:
    "finance_db": "finance-team"
  databaseSchema:
    "finance_db.accounting": "accounting-team"
    "finance_db.treasury": "treasury-team"
    "finance_db.audit": "audit-team"
  enableInheritance: true
```

**Result**:
- `finance_db` → "finance-team"
- `finance_db.accounting` and its tables → "accounting-team"
- `finance_db.treasury` and its tables → "treasury-team"
- `finance_db.audit` and its tables → "audit-team"
- Other schemas in finance_db → "finance-team" (inherited)

---

### Example 4: Multiple Users for Collaboration

**Use Case**: Multiple data analysts collaborate on analytics tables

```yaml
ownerConfig:
  default: "data-platform-team"
  table:
    "analytics_db.reporting.revenue_analysis": ["alice", "bob", "charlie"]
    "analytics_db.reporting.customer_insights": ["david", "emma"]
```

**Result**:
- `revenue_analysis` table → 3 owners (alice, bob, charlie)
- `customer_insights` table → 2 owners (david, emma)
- All owners must be users (type="user")

---

### Example 5: Disable Inheritance for Fine Control

**Use Case**: Only explicitly configured entities should have owners

```yaml
ownerConfig:
  default: "data-platform-team"
  enableInheritance: false
  database:
    "sales_db": "sales-team"
  table:
    "sales_db.public.orders": "order-team"
    "sales_db.public.customers": "customer-team"
```

**Result**:
- `sales_db` → "sales-team"
- `sales_db.public` → "data-platform-team" (default, NOT inherited)
- `sales_db.public.orders` → "order-team"
- `sales_db.public.customers` → "customer-team"
- Other tables → "data-platform-team" (default, NOT inherited)

---

### Example 6: Simple Name Matching for Convenience

**Use Case**: Apply same owner to all tables named "orders" across databases

```yaml
ownerConfig:
  default: "data-platform-team"
  table:
    "orders": "order-team"
    "customers": "customer-team"
```

**Result** (with INFO logs):
- `sales_db.public.orders` → "order-team"
- `analytics_db.staging.orders` → "order-team"
- `finance_db.reporting.orders` → "order-team"
- Any `customers` table → "customer-team"

---

## Advanced Topics

### Combining FQN and Simple Name

```yaml
table:
  "sales_db.public.orders": "sales-order-team"  # Specific FQN
  "orders": "generic-order-team"                 # Fallback for other orders tables
```

**Behavior**:
- `sales_db.public.orders` → "sales-order-team" (FQN match, no INFO log)
- `analytics_db.staging.orders` → "generic-order-team" (simple name match, INFO log)

### Inheritance Chain

**Config**:
```yaml
database:
  "sales_db": "sales-team"
databaseSchema:
  "sales_db.staging": "staging-team"
enableInheritance: true
```

**Result**:
- `sales_db` → "sales-team"
- `sales_db.public` → "sales-team" (inherited from database)
- `sales_db.staging` → "staging-team" (specific config)
- `sales_db.public.orders` → "sales-team" (inherited from public schema)
- `sales_db.staging.temp_table` → "staging-team" (inherited from staging schema)

### Email-based Owner Assignment

```yaml
default: "admin@company.com"
database:
  "sensitive_db": ["dpo@company.com", "security@company.com"]
```

System will:
1. Try lookup by name "dpo@company.com"
2. If not found, try lookup by email
3. Same for "security@company.com"

---

## Best Practices

### 1. Use FQN for Critical Entities
```yaml
# ✅ Good - Precise control
table:
  "finance_db.accounting.revenue": "revenue-team"

# ⚠️ Less precise - affects all revenue tables
table:
  "revenue": "revenue-team"
```

### 2. Enable Inheritance by Default
```yaml
# ✅ Good - Less configuration needed
ownerConfig:
  enableInheritance: true
  database:
    "sales_db": "sales-team"
# All schemas and tables in sales_db inherit automatically

# ❌ More maintenance
ownerConfig:
  enableInheritance: false
  database:
    "sales_db": "sales-team"
  databaseSchema:
    "sales_db.public": "sales-team"
    "sales_db.staging": "sales-team"
  # ... need to configure every entity
```

### 3. Use Teams for Database/Schema, Users for Tables
```yaml
# ✅ Good practice
database:
  "sales_db": "sales-team"           # Team owns database
table:
  "sales_db.public.revenue": ["analyst1", "analyst2"]  # Users collaborate on table
```

### 4. Always Define a Default
```yaml
# ✅ Good - Ensures all entities have an owner
ownerConfig:
  default: "data-platform-team"
  database:
    "sales_db": "sales-team"
```

### 5. Test Configuration Before Production
Use the test suite to validate your configuration works as expected before applying to production data.

---

## Troubleshooting

### Owner Not Assigned

**Symptoms**: Entity shows no owner after ingestion

**Check**:
1. Verify owner exists in OpenMetadata
2. Check `overrideMetadata: true` is set
3. Review logs for validation errors
4. Ensure JWT token is valid

**Solution**:
```bash
# Check if owner exists
curl -X GET "http://localhost:8585/api/v1/teams/name/<team-name>" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Check ingestion logs
grep -i "owner" logs/ingestion.log
```

### Inheritance Not Working

**Symptoms**: Child entity uses default instead of parent owner

**Check**:
1. Verify `enableInheritance: true`
2. Check parent entity has an owner
3. Review DEBUG logs for inheritance

**Solution**:
```yaml
# Ensure inheritance is enabled
ownerConfig:
  enableInheritance: true  # ← Must be true
  database:
    "sales_db": "sales-team"
```

### Validation Errors

**Symptoms**: WARNING logs about mixed types or multiple teams

**Check**:
1. Owner types in OpenMetadata (user vs team)
2. Configuration has mixed types
3. Multiple teams in array

**Solution**:
```yaml
# ❌ Wrong - Mixed types
table:
  "orders": ["alice", "bob", "sales-team"]

# ✅ Correct - All users
table:
  "orders": ["alice", "bob", "charlie"]

# ✅ Correct - Single team (string)
table:
  "orders": "sales-team"
```

### Simple Name Matching Too Broad

**Symptoms**: Unexpected entities getting the same owner

**Problem**:
```yaml
table:
  "orders": "sales-team"
# Affects ALL tables named "orders" across all databases
```

**Solution**: Use FQN for precision
```yaml
table:
  "sales_db.public.orders": "sales-team"
  "analytics_db.staging.orders": "analytics-team"
```

---