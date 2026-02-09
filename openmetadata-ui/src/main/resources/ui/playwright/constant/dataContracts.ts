/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { uuid } from '../utils/common';

export const DATA_CONTRACT_DETAILS = {
  name: `data_contract_${uuid()}`,
  description: 'new data contract description',
  termsOfService:
    'This is playwright article body here you can add rich text and block, it also support the slash command.',
  displayName: `Data Contract_${uuid()}`,
  description2: 'Modified Data Contract Description',
};

export const DATA_CONTRACT_SEMANTICS1 = {
  name: `data_contract_semantic_1_${uuid()}`,
  description: 'new data contract semantic description 1',
  rules: [
    {
      field: 'Owners',
      operator: 'Is',
    },
    {
      field: 'Description',
      operator: 'Is Set',
    },
  ],
};

export const DATA_CONTRACT_SEMANTICS2 = {
  name: `data_contract_semantic_2_${uuid()}`,
  description: 'new data contract semantic description 2',
  rules: [
    {
      field: 'Display Name',
      operator: 'Is Set',
    },
  ],
};

export const NEW_TABLE_TEST_CASE = {
  name: `table_column_count_to_equal_in_id_${uuid()}`,
  label: 'Table Column Count To Equal',
  type: 'tableColumnCountToEqual',
  value: '1000',
  description: 'New table test case for TableColumnCountToEqual',
};

export const DATA_CONTRACT_CONTAIN_SEMANTICS = {
  name: `data_contract_container_semantic_${uuid()}`,
  description: 'new data contract semantic contains description ',
  rules: [
    {
      field: 'Tier',
      operator: 'Contains',
    },
    {
      field: 'Tags',
      operator: 'Contains',
    },
    {
      field: 'Glossary Term',
      operator: 'Contains',
    },
  ],
};

export const DATA_CONTRACT_NOT_CONTAIN_SEMANTICS = {
  name: `data_contract_container_semantic_${uuid()}`,
  description: 'new data contract semantic contains description ',
  rules: [
    {
      field: 'Tier',
      operator: 'Not Contains',
    },
    {
      field: 'Tags',
      operator: 'Not Contains',
    },
    {
      field: 'Glossary Term',
      operator: 'Not Contains',
    },
  ],
};

export interface DataContractSecuritySlaData {
  consumers: {
    accessPolicyName: string;
    identities: string[];
    row_filters: {
      index: number;
      column_name: string;
      values: string[];
    }[];
  };
  dataClassificationName: string;
  refreshFrequencyIntervalInput: string;
  maxLatencyValueInput: string;
  retentionPeriodInput: string;
  availability: string;
  refreshFrequencyUnitSelect: string;
  maxLatencyUnitSelect: string;
  retentionUnitSelect: string;
  timezone: string;
}

export const DATA_CONTRACT_SECURITY_DETAILS_1: DataContractSecuritySlaData = {
  consumers: {
    accessPolicyName: 'Test Policy Security',
    identities: ['test_1', 'test_2'],
    row_filters: [
      {
        index: 0,
        column_name: 'Column 1',
        values: ['value_1', 'value_2'],
      },
      {
        index: 1,
        column_name: 'Column 2',
        values: ['value_3', 'value_4'],
      },
    ],
  },
  dataClassificationName: 'PII',
  refreshFrequencyIntervalInput: '10',
  maxLatencyValueInput: '20',
  retentionPeriodInput: '30',
  availability: '12:15',
  timezone: 'GMT+09:00 (Asia/Tokyo)',
  refreshFrequencyUnitSelect: 'Day',
  maxLatencyUnitSelect: 'Hour',
  retentionUnitSelect: 'Week',
};

export const DATA_CONTRACT_SECURITY_DETAILS_2: DataContractSecuritySlaData = {
  consumers: {
    accessPolicyName: 'Updated Policy Security',
    identities: ['test_3', 'test_4'],
    row_filters: [
      {
        index: 0,
        column_name: 'Column 3',
        values: ['value_5', 'value_6'],
      },
      {
        index: 1,
        column_name: 'Column 4',
        values: ['value_7', 'value_8'],
      },
    ],
  },
  dataClassificationName: 'PersonalData',
  refreshFrequencyIntervalInput: '50',
  maxLatencyValueInput: '60',
  retentionPeriodInput: '70',
  availability: '05:34',
  timezone: 'GMT+02:00 (Europe/Athens)',
  refreshFrequencyUnitSelect: 'Hour',
  maxLatencyUnitSelect: 'Minute',
  retentionUnitSelect: 'Year',
};

export const DATA_CONTRACT_SECURITY_DETAILS_2_VERIFIED_DETAILS = {
  consumers: {
    accessPolicyName: 'Updated Policy Security',
    identities: ['test_1', 'test_2', 'test_3', 'test_4'],
    row_filters: [
      {
        index: 0,
        column_name: 'Column 3',
        values: ['value_1', 'value_2', 'value_5', 'value_6'],
      },
      {
        index: 1,
        column_name: 'Column 4',
        values: ['value_3', 'value_4', 'value_7', 'value_8'],
      },
    ],
  },
} as DataContractSecuritySlaData;

export const DATA_CONTRACT_SECURITY_CONSUMER_DETAILS = {
  accessPolicyName: 'Test Consumer Security 2',
  identities: ['identity_1', 'identity_2'],
  row_filters: [
    {
      index: 0,
      column_name: 'Consumer_Column_1',
      values: ['column_value_1', 'column_value_2'],
    },
    {
      index: 1,
      column_name: 'Consumer_Column_2',
      values: ['column_value_3', 'column_value_4'],
    },
  ],
};

export const DATA_CONTRACT_SEMANTIC_OPERATIONS = {
  is: 'Is',
  is_not: 'Is Not',
  any_in: 'Any in',
  not_in: 'Not in',
  is_set: 'Is Set',
  is_not_set: 'Is Not Set',
  less: '<',
  greater: '>',
  less_equal: '<=',
  greater_equal: '>=',
  contains: 'Contains',
  not_contains: 'Not contains',
  between: 'Between',
  not_between: 'Not between',
};

// ODCS Sample YAMLs for Import/Export Testing

// Minimal ODCS contract - just required fields
export const ODCS_MINIMAL_YAML = `apiVersion: v3.1.0
kind: DataContract
id: minimal-contract
name: Minimal ODCS Contract
version: "1.0.0"
status: active
`;

// ODCS with SLA properties
export const ODCS_WITH_SLA_YAML = `apiVersion: v3.1.0
kind: DataContract
id: sla-contract
name: ODCS Contract with SLA
version: "1.0.0"
status: active
slaProperties:
  - property: freshness
    value: "24"
    unit: hour
  - property: latency
    value: "30"
    unit: minute
  - property: retention
    value: "365"
    unit: day
`;

// ODCS with schema definition (empty schema to avoid column mismatch with dynamic test tables)
export const ODCS_WITH_SCHEMA_YAML = `apiVersion: v3.1.0
kind: DataContract
id: schema-contract
name: ODCS Contract with Schema
version: "1.0.0"
status: active
description:
  purpose: Contract with schema placeholder
  usage: For testing schema import
`;

// ODCS with team/owner information (team is ignored during import as it requires entity resolution)
export const ODCS_WITH_TEAM_YAML = `apiVersion: v3.1.0
kind: DataContract
id: team-contract
name: ODCS Contract with Team
version: "1.0.0"
status: active
team:
  - name: Data Platform Team
    role: owner
  - name: Analytics Team
    role: consumer
`;

// ODCS with description fields
export const ODCS_WITH_DESCRIPTION_YAML = `apiVersion: v3.1.0
kind: DataContract
id: description-contract
name: ODCS Contract with Description
version: "1.0.0"
status: active
description:
  purpose: This contract defines the data quality standards for user data.
  limitations: Data is refreshed daily, not real-time.
  usage: Use for analytics and reporting purposes only.
`;

// Full ODCS contract with all fields (schema removed to avoid validation failures with dynamic test tables)
export const ODCS_FULL_CONTRACT_YAML = `apiVersion: v3.1.0
kind: DataContract
id: full-contract
name: Complete ODCS Contract
version: "2.0.0"
status: active
description:
  purpose: Comprehensive data contract for customer analytics.
  limitations: Historical data only, no PII exposed.
  usage: For internal analytics dashboards and ML models.
slaProperties:
  - property: freshness
    value: "12"
    unit: hour
  - property: latency
    value: "2"
    unit: hour
  - property: retention
    value: "365"
    unit: day
team:
  - name: Customer Data Team
    role: owner
  - name: Marketing Analytics
    role: consumer
  - name: Data Science Team
    role: consumer
`;

// ODCS with v3.0.2 version (backwards compatibility)
export const ODCS_V302_YAML = `apiVersion: v3.0.2
kind: DataContract
id: v302-contract
name: ODCS v3.0.2 Contract
version: "1.0.0"
status: active
`;

// ODCS with draft status
export const ODCS_DRAFT_STATUS_YAML = `apiVersion: v3.1.0
kind: DataContract
id: draft-contract
name: Draft ODCS Contract
version: "0.1.0"
status: draft
description:
  purpose: This is a draft contract under review.
`;

// Invalid ODCS - missing required fields
export const ODCS_INVALID_MISSING_FIELDS_YAML = `apiVersion: v3.1.0
kind: DataContract
name: Invalid Contract
`;

// Invalid ODCS - malformed YAML
export const ODCS_INVALID_MALFORMED_YAML = `apiVersion: v3.1.0
kind: DataContract
id: malformed
  name: Bad Indentation
    version: "1.0.0"
status: active
`;

// ODCS with v3.1.0 timestamp/time types and timezone
export const ODCS_WITH_TIMESTAMP_YAML = `apiVersion: v3.1.0
kind: DataContract
id: timestamp-contract
name: ODCS Contract with Timestamp Types
version: "1.0.0"
status: active
description:
  purpose: Contract testing v3.1.0 timestamp and time types
slaProperties:
  - property: freshness
    value: "6"
    unit: hour
    timezone: GMT+00:00 UTC
  - property: latency
    value: "15"
    unit: minute
  - property: availability
    value: "99.9"
    unit: percent
    timezone: GMT-05:00 America/New_York
`;

// ODCS with quality rules
export const ODCS_WITH_QUALITY_RULES_YAML = `apiVersion: v3.1.0
kind: DataContract
id: quality-contract
name: ODCS Contract with Quality Rules
version: "1.0.0"
status: active
description:
  purpose: Contract testing quality rules
quality:
  - type: library
    rule: nullValues
    column: id
    mustBe: 0
    description: ID column must not have null values
  - type: library
    rule: duplicateValues
    column: email
    mustBe: 0
    description: Email must be unique
  - type: custom
    rule: "price >= 0"
    column: price
    description: Price must be non-negative
`;

// ODCS with security/roles
export const ODCS_WITH_SECURITY_YAML = `apiVersion: v3.1.0
kind: DataContract
id: security-contract
name: ODCS Contract with Security
version: "1.0.0"
status: active
description:
  purpose: Contract testing security roles
roles:
  - role: data_admin
    description: Full access to all data
    access: readWrite
  - role: analyst
    description: Read-only access for analysis
    access: read
  - role: auditor
    description: Audit access for compliance
    access: read
`;

// ODCS with PII classification (testing that custom string classifications work)
export const ODCS_WITH_PII_CLASSIFICATION_YAML = `apiVersion: v3.1.0
kind: DataContract
id: pii-classification-contract
name: ODCS Contract with PII Classification
version: "1.0.0"
status: active
description:
  purpose: Contract testing PII classification support
schema:
  - name: users
    properties:
      - name: email
        logicalType: string
        classification: PII
        description: User email - contains personal information
      - name: name
        logicalType: string
        classification: PersonalData
      - name: public_id
        logicalType: string
        classification: public
`;

// ODCS for merge mode testing - initial contract
export const ODCS_MERGE_INITIAL_YAML = `apiVersion: v3.1.0
kind: DataContract
id: merge-test-initial
name: Merge Test Contract
version: "1.0.0"
status: draft
description:
  purpose: Initial contract for merge testing
slaProperties:
  - property: freshness
    value: "24"
    unit: hour
`;

// ODCS for merge mode testing - update with different fields
export const ODCS_MERGE_UPDATE_YAML = `apiVersion: v3.1.0
kind: DataContract
id: merge-test-update
name: Different Name for Merge
version: "2.0.0"
status: active
description:
  purpose: Updated description via merge mode
`;

// ODCS for replace mode testing
export const ODCS_REPLACE_YAML = `apiVersion: v3.1.0
kind: DataContract
id: replace-test
name: Completely Different Name
version: "3.0.0"
status: active
description:
  purpose: Completely replaced contract via replace mode
`;

// ODCS Test Data Constants - matching test-data/odcs-examples files
// Valid YAML test data
export const ODCS_VALID_BASIC_YAML = `apiVersion: v3.1.0
kind: DataContract
id: basic-contract
name: Orders Basic Contract
version: "1.0.0"
status: active
`;

export const ODCS_VALID_FULL_YAML = `apiVersion: v3.1.0
kind: DataContract
id: full-contract
name: Customer Analytics Full Contract
version: "2.1.0"
status: active
description:
  purpose: Comprehensive data contract for customer analytics.
  limitations: Historical data only, no PII exposed.
  usage: For internal analytics dashboards and ML models.
slaProperties:
  - property: freshness
    value: "12"
    unit: hour
  - property: latency
    value: "2"
    unit: hour
  - property: retention
    value: "365"
    unit: day
roles:
  - role: data_admin
    description: Full access to all data
    access: readWrite
  - role: analyst
    description: Read-only access for analysis
    access: read
`;

export const ODCS_VALID_DRAFT_STATUS_YAML = `apiVersion: v3.1.0
kind: DataContract
id: draft-contract
name: Draft ODCS Contract
version: "0.1.0"
status: draft
description:
  purpose: This is a draft contract under review.
`;

export const ODCS_VALID_WITH_TIMESTAMPS_YAML = `apiVersion: v3.1.0
kind: DataContract
id: timestamp-contract
name: ODCS Contract with Timestamp Types
version: "1.0.0"
status: active
description:
  purpose: Contract testing v3.1.0 timestamp and time types
slaProperties:
  - property: freshness
    value: "6"
    unit: hour
    timezone: GMT+00:00 UTC
  - property: latency
    value: "15"
    unit: minute
  - property: availability
    value: "99.9"
    unit: percent
    timezone: GMT-05:00 America/New_York
`;

export const ODCS_VALID_QUALITY_RULES_YAML = `apiVersion: v3.1.0
kind: DataContract
id: product-inventory-contract
name: Product Inventory Contract
version: "1.5.0"
status: active
description:
  purpose: Ensure product inventory data quality
schema:
  - name: products
    logicalType: object
    properties:
      - name: sku
        logicalType: string
        primaryKey: true
      - name: product_name
        logicalType: string
        required: true
      - name: category
        logicalType: string
        required: true
      - name: price
        logicalType: decimal
        logicalTypeOptions:
          precision: 10
          scale: 2
      - name: stock_quantity
        logicalType: integer
      - name: last_updated
        logicalType: timestamp
quality:
  - type: library
    rule: rowCount
    mustBeGreaterThan: 1000
    description: Product catalog must have at least 1000 items
  - type: library
    rule: nullValues
    column: sku
    mustBe: 0
    description: SKU cannot be null
  - type: library
    rule: nullValues
    column: product_name
    mustBe: 0
    description: Product name is required
  - type: library
    rule: duplicateValues
    column: sku
    mustBe: 0
    description: SKU must be unique
  - type: custom
    rule: "price > 0"
    column: price
    description: Price must be positive
slaProperties:
  - property: freshness
    value: "6"
    unit: hours
  - property: availability
    value: "99.5"
    unit: percent
`;

export const ODCS_VALID_QUALITY_RULES_BETWEEN_YAML = `apiVersion: v3.1.0
kind: DataContract
id: quality-rules-between-contract
name: Quality Rules Between Contract
version: "1.0.0"
status: active
description:
  purpose: Test quality rules with mustBeBetween and mustNotBeBetween assertions
quality:
  - type: library
    metric: rowCount
    description: Row count must be between 100 and 10000
    mustBeBetween:
      - 100
      - 10000
  - type: library
    metric: nullValues
    column: email
    description: Null percentage must not be between 10 and 90
    mustNotBeBetween:
      - 10
      - 90
  - type: library
    metric: uniqueValues
    column: id
    description: Unique values with multiple assertions
    mustBeGreaterThan: 0
    mustBeLessThan: 1000000
`;

export const ODCS_VALID_WITH_TEAM_YAML = `apiVersion: v3.1.0
kind: DataContract
id: team-owner-contract
name: Team Owner Contract
version: "1.0.0"
status: active
description:
  purpose: Test team/owner resolution during import
team:
  - username: admin
    name: Admin User
    role: owner
  - username: developer1
    name: Developer One
    role: developer
  - username: reviewer1
    name: Reviewer One
    role: reviewer
`;

export const ODCS_VALID_MULTI_OBJECT_YAML = `apiVersion: v3.1.0
kind: DataContract
id: multi-object-contract
name: Multi-Object Data Contract
version: "1.0.0"
status: active
description:
  purpose: Contract with multiple schema objects for testing multi-object import
schema:
  - name: customers
    logicalType: object
    physicalType: table
    description: Customer records table
    properties:
      - name: customer_id
        logicalType: integer
        required: true
        primaryKey: true
      - name: customer_name
        logicalType: string
        required: true
      - name: email
        logicalType: string
        required: false
  - name: orders
    logicalType: object
    physicalType: table
    description: Customer orders table
    properties:
      - name: order_id
        logicalType: integer
        required: true
        primaryKey: true
      - name: customer_id
        logicalType: integer
        required: true
      - name: order_date
        logicalType: timestamp
      - name: total_amount
        logicalType: number
  - name: products
    logicalType: object
    physicalType: table
    description: Product catalog table
    properties:
      - name: product_id
        logicalType: integer
        required: true
        primaryKey: true
      - name: product_name
        logicalType: string
        required: true
      - name: price
        logicalType: number
slaProperties:
  - property: freshness
    value: "24"
    unit: hours
`;

// Multi-object YAML without schema properties for import testing
// (schema validation passes since there are no properties to validate)
export const ODCS_VALID_MULTI_OBJECT_SIMPLE_YAML = `apiVersion: v3.1.0
kind: DataContract
id: multi-object-simple-contract
name: Multi-Object Simple Contract
version: "1.0.0"
status: active
description:
  purpose: Contract with multiple schema objects for testing multi-object import (no properties)
schema:
  - name: customers
    logicalType: object
    physicalType: table
    description: Customer records table
  - name: orders
    logicalType: object
    physicalType: table
    description: Customer orders table
  - name: products
    logicalType: object
    physicalType: table
    description: Product catalog table
slaProperties:
  - property: freshness
    value: "12"
    unit: hours
`;

export const ODCS_INVALID_MISSING_APIVERSION_YAML = `kind: DataContract
id: missing-apiversion
name: Missing API Version Contract
version: "1.0.0"
status: active
`;

export const ODCS_INVALID_MISSING_STATUS_YAML = `apiVersion: v3.1.0
kind: DataContract
id: missing-status
name: Missing Status Contract
version: "1.0.0"
`;

export const ODCS_INVALID_EMPTY_FILE_YAML = `# this is a comment
# no actual content
`;

export const ODCS_INVALID_MISSING_KIND_YAML = `apiVersion: v3.1.0
id: missing-kind
name: Missing Kind Contract
version: "1.0.0"
status: active
`;

export const ODCS_INVALID_WRONG_APIVERSION_YAML = `apiVersion: v1.0.0
kind: DataContract
id: wrong-version
name: Wrong API Version Contract
version: "1.0.0"
status: active
`;

export const ODCS_INVALID_WRONG_KIND_YAML = `apiVersion: v3.1.0
kind: WrongKind
id: wrong-kind
name: Wrong Kind Contract
version: "1.0.0"
status: active
`;

export const ODCS_INVALID_SCHEMA_FIELDS_YAML = `apiVersion: v3.1.0
kind: DataContract
id: invalid-schema-contract
name: Contract with Invalid Schema Fields
version: "1.0.0"
status: active
description:
  purpose: Testing schema validation - these fields don't exist in the table
schema:
  - name: data
    properties:
      - name: customers
        logicalType: string
        description: This field does not exist in the table
      - name: orders
        logicalType: integer
        description: This field does not exist in the table
      - name: nonexistent_field
        logicalType: string
        description: Another field that does not exist
`;

// JSON format test data
export const ODCS_VALID_BASIC_JSON = `{
  "apiVersion": "v3.1.0",
  "kind": "DataContract",
  "id": "basic-contract-json",
  "name": "Basic ODCS Contract JSON",
  "version": "1.0.0",
  "status": "active"
}`;

export const ODCS_INVALID_MALFORMED_JSON = `{
  "apiVersion": "v3.1.0",
  "kind": "DataContract",
  "id": "malformed-json"
  "name": "Missing comma"
}`;

// Helper function to generate unique ODCS contract
export const generateODCSContract = (
  name: string,
  options?: {
    status?: 'active' | 'draft' | 'retired';
    version?: string;
    withSla?: boolean;
    withSchema?: boolean;
  }
): string => {
  const id = `${name.toLowerCase().replace(/\s+/g, '-')}-${uuid()}`;
  const status = options?.status ?? 'active';
  const version = options?.version ?? '1.0.0';

  let yaml = `apiVersion: v3.1.0
kind: DataContract
id: ${id}
name: ${name}
version: "${version}"
status: ${status}
`;

  if (options?.withSla) {
    yaml += `slaProperties:
  - property: freshness
    value: "24"
    unit: hour
`;
  }

  if (options?.withSchema) {
    yaml += `schema:
  - name: id
    logicalType: integer
    required: true
  - name: name
    logicalType: string
    required: true
`;
  }

  return yaml;
};

export const ODCS_VALID_WITH_MARKDOWN_DESCRIPTION_YAML = `apiVersion: v3.1.0
kind: DataContract
id: markdown-description-contract
name: Markdown Description Contract
version: "1.0.0"
status: active
description:
  purpose: |
    # Data Contract Overview

    This contract defines the **quality standards** for our _customer analytics_ data.

    ## Key Features

    - **Real-time updates** every 15 minutes
    - *Historical data* retention for 365 days
    - Supports \`SQL\` and \`Python\` queries

    ### Data Sources

    1. Customer transactions
    2. User behavior logs
    3. Product catalog

    > Note: This data is subject to GDPR compliance requirements.

    For more details, see the [documentation](https://example.com/docs).
`;
