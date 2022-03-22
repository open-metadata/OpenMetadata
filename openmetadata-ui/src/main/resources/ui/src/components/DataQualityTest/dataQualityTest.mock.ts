export const columns = [
  {
    name: 'user_id',
    displayName: 'user_id',
    dataType: 'NUMERIC',
    dataTypeDisplay: 'numeric',
    description:
      'Unique identifier for the user of your Shopify POS or your Shopify admin.',
    fullyQualifiedName: 'bigquery_gcp.shopify.dim_staff.user_id',
    tags: [],
    constraint: 'PRIMARY_KEY',
    ordinalPosition: 1,
    columnTests: [
      {
        id: '25b358ef-5912-42ba-a1dc-d77f434626e2',
        name: 'user_id.columnValuesToBeBetween',
        description: 'user_id should be positive',
        columnName: 'user_id',
        testCase: {
          config: {
            maxValue: null,
            minValue: 0,
          },
          columnTestType: 'columnValuesToBeBetween',
        },
        executionFrequency: 'Daily',
        results: [
          {
            executionTime: 1646221199,
            testCaseStatus: 'Success',
            result: 'Found min=1.0 vs. the expected min=0',
          },
          {
            executionTime: 1646220190,
            testCaseStatus: 'Success',
            result: 'Found min=1.0 vs. the expected min=0',
          },
        ],
        updatedAt: 1647836435937,
        updatedBy: 'anonymous',
      },
      {
        id: '7faac46a-67bc-4c4d-96a5-42cc4b6e3e34',
        name: 'user_id.columnValuesToBeNotNull',
        description: 'user_id should be not null',
        columnName: 'user_id',
        testCase: {
          config: {
            columnValuesToBeUnique: true,
          },
          columnTestType: 'columnValuesToBeNotNull',
        },
        executionFrequency: 'Daily',
        results: [
          {
            executionTime: 1646220190,
            testCaseStatus: 'Success',
            result: 'Found nullCount=0',
          },
          {
            executionTime: 1646221199,
            testCaseStatus: 'Success',
            result: 'Found nullCount=0',
          },
        ],
        updatedAt: 1647836436004,
        updatedBy: 'anonymous',
      },
    ],
  },
  {
    name: 'first_name',
    displayName: 'first_name',
    dataType: 'VARCHAR',
    dataLength: 100,
    dataTypeDisplay: 'varchar',
    description: 'First name of the staff member.',
    fullyQualifiedName: 'bigquery_gcp.shopify.dim_staff.first_name',
    tags: [],
    ordinalPosition: 3,
    columnTests: [
      {
        id: 'f7963a5a-d6fc-4535-a42a-4d75739c7ec5',
        name: 'first_name.columnValuesMissingCountToBeEqual',
        description: 'Some description...',
        columnName: 'first_name',
        testCase: {
          config: {
            missingCountValue: 10,
            missingValueMatch: null,
          },
          columnTestType: 'columnValuesMissingCountToBeEqual',
        },
        executionFrequency: 'Daily',
        results: [
          {
            executionTime: 1646220190,
            testCaseStatus: 'Failed',
            result: 'Found nullCount=0.0 vs. the expected nullCount=10',
          },
          {
            executionTime: 1646221199,
            testCaseStatus: 'Failed',
            result: 'Found nullCount=0.0 vs. the expected nullCount=10',
          },
        ],
        updatedAt: 1647836436045,
        updatedBy: 'anonymous',
      },
    ],
  },
];

export const tableTests = [
  {
    id: '37f2b8c3-9caa-4b39-8e9b-6047591888a4',
    name: 'dim_staff.tableRowCountToEqual',
    description: 'Rows should always be 100 because of something',
    testCase: {
      config: {
        value: 120,
      },
      tableTestType: 'tableRowCountToEqual',
    },
    executionFrequency: 'Daily',
    results: [
      {
        executionTime: 1646221199,
        testCaseStatus: 'Failed',
        result: 'Found 100.0 rows vs. the expected 120',
      },
      {
        executionTime: 1646220190,
        testCaseStatus: 'Success',
        result: 'Found 120.0 rows vs. the expected 120',
      },
    ],
    updatedAt: 1647836435877,
    updatedBy: 'anonymous',
  },
  {
    id: 'e1d0b6af-c4cf-4873-adc6-05b6ed0c51f9',
    name: 'dim_staff.tableRowCountToBeBetween',
    description: 'Rows should always be 100 because of something',
    testCase: {
      config: {
        maxValue: 200,
        minValue: 100,
      },
      tableTestType: 'tableRowCountToBeBetween',
    },
    executionFrequency: 'Daily',
    results: [
      {
        executionTime: 1646220190,
        testCaseStatus: 'Success',
        result: 'Found 120.0 rows vs. the expected range [100, 200]',
      },
      {
        executionTime: 1646221199,
        testCaseStatus: 'Success',
        result: 'Found 120.0 rows vs. the expected range [100, 200]',
      },
    ],
    updatedAt: 1647836435910,
    updatedBy: 'anonymous',
  },
  {
    id: '734e4251-f9c3-45e8-82eb-f0bdfd780660',
    name: 'dim_staff.tableColumnCountToEqual',
    description: 'We expect certain columns',
    testCase: {
      config: {
        value: 5,
      },
      tableTestType: 'tableColumnCountToEqual',
    },
    executionFrequency: 'Daily',
    results: [
      {
        executionTime: 1646221199,
        testCaseStatus: 'Success',
        result: 'Found 5.0 columns vs. the expected 5',
      },
    ],
    updatedAt: 1647836435888,
    updatedBy: 'anonymous',
  },
];
