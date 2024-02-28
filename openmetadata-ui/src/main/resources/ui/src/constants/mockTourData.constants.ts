/*
 *  Copyright 2022 Collate.
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

import { SearchIndex } from '../enums/search.enum';

/* eslint-disable max-len */

export const MOCK_ASSETS_COUNTS = {
  tableCount: 43,
  topicCount: 10,
  dashboardCount: 14,
  pipelineCount: 8,
  mlmodelCount: 2,
  servicesCount: 12,
  userCount: 125,
  teamCount: 16,
  testSuiteCount: 1,
  storageContainerCount: 7,
  glossaryCount: 24,
  glossaryTermCount: 24,
};

export const mockFeedData = [
  {
    id: '52d52eb1-b990-497f-bf80-47e52c106f85',
    href: 'http://localhost:8585/api/v1/feed/52d52eb1-b990-497f-bf80-47e52c106f85',
    threadTs: 1646631348958,
    about:
      '<#E::table::bigquery_gcp.shopify.raw_product_catalog::columns::comments::description>',
    entityId: '96e80f92-b8ce-456c-8f3c-ee7855e76f43',
    createdBy: 'aaron_johnson0',
    updatedAt: 1646631348959,
    updatedBy: 'anonymous',
    resolved: false,
    message:
      'This dimension table contains information about the staff accounts in the store. It contains one row per staff account. Use this table to generate a list of your staff accounts, or join it with the sales, API clients and locations tables to analyze staff performance at Shopify POS locations.',
    postsCount: 0,
    posts: [],
  },
  {
    id: '60df2514-3bea-4337-a5a2-f0fe5c65237f',
    href: 'http://localhost:8585/api/v1/feed/60df2514-3bea-4337-a5a2-f0fe5c65237f',
    threadTs: 1646631340215,
    about:
      '<#E::table::bigquery_gcp.shopify.raw_product_catalog::columns::comments::description>',
    entityId: '96e80f92-b8ce-456c-8f3c-ee7855e76f43',
    createdBy: 'aaron_johnson0',
    updatedAt: 1646631340215,
    updatedBy: 'anonymous',
    resolved: false,
    message: 'Can you add a description?',
    postsCount: 0,
    posts: [],
  },
];

export const mockLineageData = {
  entity: {
    id: '46ac510f-0b5a-4458-be22-18bb45680f29',
    type: 'table',
    name: 'bigquery_gcp.shopify.dim_address',
    description:
      'This dimension table contains the billing and shipping addresses of customers. You can join this table with the sales table to generate lists of the billing and shipping addresses. Customers can enter their addresses more than once, so the same address can appear in more than one row in this table. This table contains one row per customer address.',
    href: 'http://localhost:8585/api/v1/tables/46ac510f-0b5a-4458-be22-18bb45680f29',
  },
  nodes: [
    {
      id: '59a71417-5625-4e30-adf6-e662668ca15f',
      type: 'pipeline',
      name: 'sample_airflow.dim_address_etl',
      description: 'dim_address ETL pipeline',
      displayName: 'dim_address etl',
      href: 'http://localhost:8585/api/v1/pipelines/59a71417-5625-4e30-adf6-e662668ca15f',
    },
    {
      id: '0c57f9a7-04f4-48f6-9242-9de727285ece',
      type: 'table',
      name: 'bigquery_gcp.shopify.raw_customer',
      description:
        'This is a raw customers table as represented in our online DB. This contains personal, shipping and billing addresses and details of the customer store and customer profile. This table is used to build our dimensional and fact tables',
      href: 'http://localhost:8585/api/v1/tables/0c57f9a7-04f4-48f6-9242-9de727285ece',
    },
  ],
  upstreamEdges: [
    {
      fromEntity: '59a71417-5625-4e30-adf6-e662668ca15f',
      toEntity: '46ac510f-0b5a-4458-be22-18bb45680f29',
    },
    {
      fromEntity: '0c57f9a7-04f4-48f6-9242-9de727285ece',
      toEntity: '59a71417-5625-4e30-adf6-e662668ca15f',
    },
  ],
  downstreamEdges: [],
};

export const mockTablePermission = {
  Create: true,
  Delete: true,
  ViewAll: true,
  EditAll: true,
};

export const mockDatasetData = {
  datasetFQN: 'sample_data.ecommerce_db.shopify.dim_address',
  tableProfile: {
    timestamp: '1682049950',
    columnCount: 12,
    rowCount: 14567,
    profileSampleType: 'PERCENTAGE',
  },
  sampleData: {
    columns: [
      'address_id',
      'shop_id',
      'first_name',
      'last_name',
      'address1',
      'address2',
      'company',
      'city',
      'region',
      'zip',
      'country',
      'phone',
    ],
    rows: [
      [
        'ecd07ea2-ec8d-41f7-85aa-4de3b952d232',
        'd9067963-1dc0-4235-8e63-fb4106894437',
        'Christian',
        'James',
        '7933 Richard Underpass',
        '65489 Mccullough Forge Apt. 214',
        'Brooks-Hernandez',
        'West Lindaborough',
        '82800 Hudson Curve',
        '58594',
        'Tunisia',
        '(022)051-3030',
      ],
      [
        '663a7b15-619b-4815-8f29-9c6ccb9381be',
        '13f633bf-eafb-41bb-b83f-e690369e9937',
        'Cathy',
        'Katherine',
        '7495 Webb Cove',
        '9740 Janet Center Apt. 295',
        'Dudley PLC',
        'Douglasborough',
        '7533 Michelle Point Suite 093',
        '13176',
        'Sri Lanka',
        '(630)268-8741x190',
      ],
      [
        '1e9acf83-e458-44ad-8844-6aec69949199',
        '48cb04ed-ead5-4985-af23-d11865b61fba',
        'Mary',
        'Zoe',
        '748 Armstrong Road',
        '646 Kimberly Turnpike Apt. 701',
        'Bright LLC',
        'Carlosfort',
        '323 Owens Terrace',
        '24172',
        'Iran',
        '(018)825-3516x6921',
      ],
      [
        '264bd4d0-15a3-4fa1-91b0-fcab209ec5c7',
        '1207e037-7ef3-4b10-93b7-c766a650ead0',
        'Phillip',
        'Annette',
        '87112 Schmidt Lane',
        '499 Gibson Manor Suite 036',
        'Cooper, Evans and Colon',
        'North Patricia',
        '645 Smith Drives Apt. 166',
        '25662',
        'Turkey',
        '+1-560-623-4587x015',
      ],
      [
        '30a91a8e-428f-478a-a81f-9ecee8af11dc',
        'ecf8ec82-87c7-49a4-85e5-acd200c51ecd',
        'Michael',
        'Helen',
        '418 Jones Curve Suite 442',
        '1742 Fuentes Heights Suite 674',
        'Moss, Anderson and Le',
        'Christophershire',
        '7788 Franklin Forks',
        '77790',
        'Armenia',
        '001-564-534-8416x8563',
      ],
      [
        '64111af0-86f2-4413-94d5-84fe6ac61a21',
        'f80da8e0-2319-412c-b3ae-978dded81f5e',
        'Kimberly',
        'Lisa',
        '2765 Melissa Squares Suite 985',
        '4283 Robert Mountains Suite 155',
        'Donovan, Li and Rowland',
        'Danielmouth',
        '0683 Emily Brooks',
        '26919',
        'Monaco',
        '001-055-840-1949x719',
      ],
      [
        'f2ec9582-90b0-4ad4-898a-e4329c9bfdd8',
        'b91fec72-45ba-4a3a-a6de-917ad948f087',
        'Dave',
        'Debbie',
        '1993 Nathan Hollow',
        '4609 Jason Wells',
        'Baker Group',
        'Careyside',
        '073 Short Forges',
        '84799',
        'Saint Vincent and the Grenadines',
        '+1-703-653-1367x2904',
      ],
      [
        'e8b1553c-e579-4cc0-a78d-a366be72343b',
        '6a8254fc-546b-4852-aaaf-59b46dee7707',
        'Jennifer',
        'Victor',
        '76664 Natasha Shoal Suite 347',
        '431 Justin Drive',
        'Harris, Martinez and Zhang',
        'Lorrainemouth',
        '26848 Carolyn Highway',
        '99349',
        'Nepal',
        '996-840-2805',
      ],
      [
        '1fa7b335-fe5f-42c6-b55e-dc5765d8dc8b',
        '6364feef-7b3d-4f3d-8e60-32defc42ee77',
        'Anthony',
        'Raymond',
        '531 John Shore Apt. 610',
        '912 Bates Drives Apt. 941',
        'Price, Harding and Johnson',
        'Lake Jillville',
        '6537 Tracey Islands',
        '36016',
        'United States Virgin Islands',
        '+1-604-283-8995x22178',
      ],
      [
        'd609e70b-83dd-460e-93ab-5c667b7ee797',
        '21f40af7-b9c0-401f-9ce0-f7637085619c',
        'Benjamin',
        'Charles',
        '881 Anne Crest',
        '893 Lisa Summit Apt. 259',
        'Clark-Sanders',
        'Ashleyville',
        '4985 Karen Centers Suite 064',
        '92618',
        'Mauritius',
        '7447239997',
      ],
      [
        '7ecb7295-9fc4-427d-a029-3cb8b0bfdbba',
        '975980c1-9d5b-41cd-8f96-82936169aeea',
        'Wesley',
        'Daniel',
        '427 Wilson Extensions Apt. 577',
        '620 Samantha Isle',
        'Hayes-Watkins',
        'Lake Donna',
        '8478 Rhonda Lakes',
        '05871',
        'Iraq',
        '606-817-3223',
      ],
      [
        '231f03ab-b3f1-4134-9c78-250506cd80fe',
        '934bbb2e-5fb7-4648-b2bd-2bfb83841496',
        'John',
        'Sierra',
        '3074 Jacob Locks Suite 801',
        '1894 Eric Ramp',
        'West-Rojas',
        'Port Amandaside',
        '915 Soto Ferry Apt. 794',
        '58295',
        'Ecuador',
        '761.107.2999x370',
      ],
      [
        '6026d0a1-5e66-4c16-9ed6-c743396601a5',
        '23593cfd-c476-42d5-8924-9a6fb8254896',
        'Ryan',
        'Ryan',
        '386 Carter Path',
        '221 Carroll Rue',
        'Dyer, Smith and Lowe',
        'New Tammyberg',
        '1013 Adams Stravenue',
        '63894',
        'Faroe Islands',
        '(665)656-6038x16205',
      ],
      [
        '1bacd4ca-c41e-4b1d-ba50-3ac9a7af0bf6',
        '2e678a6d-afa1-49c6-8467-89cf602addb8',
        'George',
        'Jason',
        '6496 Cheryl Stravenue Suite 457',
        '55548 Walters Locks',
        'Hart-Simmons',
        'Derekbury',
        '81671 Stacy Track',
        '66294',
        'Mauritius',
        '+1-501-936-9629x06338',
      ],
      [
        'e607e90c-a639-4b66-821a-1554b7fc7d39',
        '5820cf5e-5f1d-4803-ad03-b7ca7dcfca60',
        'Anita',
        'Crystal',
        '24541 Matthew Route',
        '8184 Jessica Point',
        'Turner-Chan',
        'Moorestad',
        '100 Carpenter Spurs',
        '46865',
        'Ethiopia',
        '+1-598-716-4672x4794',
      ],
      [
        'd67df3f5-ed74-4f22-993f-c90921492f8f',
        '64a8a934-2b94-48ee-87fd-2e5f1100e132',
        'Christian',
        'Raymond',
        '56051 Collins Camp',
        '02835 Simpson Parkways Apt. 690',
        'Walker, Davis and Lopez',
        'Port Robertmouth',
        '72027 Shaw Extensions Suite 119',
        '16713',
        'Lebanon',
        '885.772.6309',
      ],
      [
        '9c3c5fc3-b1d2-49dd-83f6-eb21ca62c943',
        '3fb997c0-ec7e-46b3-8261-41dfac8d4f1d',
        'Brandon',
        'Brittney',
        '7937 Sarah Manors',
        '0242 Tanner Mission Suite 746',
        'Martinez-Scott',
        'West Michael',
        '654 Leslie Trace',
        '80963',
        'French Southern Territories',
        '763.007.0819x5946',
      ],
      [
        '3d574a30-88ba-4192-8104-3401b18a5c26',
        '0aedcabd-0585-4822-9adb-aae5996556fe',
        'Deborah',
        'David',
        '7178 York Street Apt. 539',
        '2426 Crystal Plains',
        'Brown-Hurley',
        'Marshallshire',
        '09258 Mcguire Lakes Suite 250',
        '13172',
        'Sri Lanka',
        '+1-662-211-5221x005',
      ],
      [
        '0b5c6034-bc0b-42b9-ba5e-e9cbe8a8ee1e',
        '2ff3760d-5e52-4ffc-91dd-f98e97fc6fbd',
        'Brandon',
        'Krystal',
        '5730 Sanders Mount Suite 733',
        '927 Gregory Grove',
        'Vincent-Gonzalez',
        'Perezborough',
        '47470 Flynn Row Suite 057',
        '41816',
        'Lebanon',
        '(519)148-7430x474',
      ],
      [
        '6f89ffc5-78d6-44f2-9c8d-bc11a52deddc',
        '76d97e46-1b79-426d-a196-13f41d6f3316',
        'Karen',
        'Justin',
        '1980 John Mountain',
        '4002 Leah Trail',
        'Rasmussen, Flynn and Pittman',
        'Jacobtown',
        '4617 Fisher Causeway Suite 029',
        '50859',
        'Austria',
        '(754)208-2217',
      ],
      [
        '8bbb8913-d276-4e83-87f2-6b5b1b5eb7b4',
        '6822a50f-5865-4aaa-b67f-2db30493edb4',
        'Ricardo',
        'Samantha',
        '23504 Sandra Center Apt. 216',
        '40959 Jason Estates Apt. 696',
        'Lopez, Doyle and Griffin',
        'Port Cassandrahaven',
        '395 Coleman Prairie',
        '12593',
        'Bosnia and Herzegovina',
        '399.279.7217x2246',
      ],
    ],
  },
  entityLineage: {
    nodes: [
      {
        databaseSchema: {
          deleted: false,
          displayName: 'shopify',
          name: 'shopify',
          description:
            'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
          id: '5cd86fad-873c-4e59-b9ff-a38967aac79d',
          type: 'databaseSchema',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
        },
        serviceType: 'BigQuery',
        lineage: [
          {
            toEntity: {
              fqn: 'sample_data.ecommerce_db.shopify."dim.product"',
              id: 'f65a4402-3e82-4238-b864-bc7c89bb2e2e',
              type: 'table',
            },
            pipeline: {
              deleted: false,
              displayName: 'dim_product etl',
              name: 'dim_product_etl',
              description: 'diim_product ETL pipeline',
              id: '7b42caac-154c-4d1e-9da2-2a560979a8d7',
              type: 'pipeline',
              fullyQualifiedName: 'sample_airflow.dim_product_etl',
            },
            fromEntity: {
              fqn: 'sample_data.ecommerce_db.shopify.raw_customer',
              id: '1983c7f1-52fd-4dc7-89b9-29a8fffcfd6f',
              type: 'table',
            },
            sqlQuery:
              'insert into sample_data.ecommerce_db.shopify."dim.product" as select * from sample_data.ecommerce_db.shopify.raw_customer',
            description: null,
            source: 'Manual',
            doc_id:
              '1983c7f1-52fd-4dc7-89b9-29a8fffcfd6f-f65a4402-3e82-4238-b864-bc7c89bb2e2e',
          },
          {
            toEntity: {
              fqn: 'sample_data.ecommerce_db.shopify."dim.product"',
              id: 'f65a4402-3e82-4238-b864-bc7c89bb2e2e',
              type: 'table',
            },
            pipeline: {
              deleted: false,
              displayName: 'dim_product etl',
              name: 'dim_product_etl',
              description: 'diim_product ETL pipeline',
              id: '7b42caac-154c-4d1e-9da2-2a560979a8d7',
              type: 'pipeline',
              fullyQualifiedName: 'sample_airflow.dim_product_etl',
            },
            fromEntity: {
              fqn: 'sample_data.ecommerce_db.shopify.raw_order',
              id: 'd26498fa-05cd-4e36-b7ba-f38a7a5fd372',
              type: 'table',
            },
            sqlQuery:
              'select * from sample_data.ecommerce_db.shopify.raw_order',
            description: null,
            source: 'Manual',
            doc_id:
              'd26498fa-05cd-4e36-b7ba-f38a7a5fd372-f65a4402-3e82-4238-b864-bc7c89bb2e2e',
          },
        ],
        columns: [
          {
            dataType: 'NUMERIC',
            name: 'product_id',
            description:
              'Unique identifier for the product. This column is the primary key for this table.',
            constraint: 'PRIMARY_KEY',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product".product_id',
            ordinalPosition: 1,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataType: 'NUMERIC',
            name: 'shop_id',
            description:
              'ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product".shop_id',
            ordinalPosition: 2,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataLength: 100,
            dataType: 'VARCHAR',
            name: 'title',
            description: 'Name of the product.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product".title',
            ordinalPosition: 3,
            dataTypeDisplay: 'varchar',
            tags: [],
          },
          {
            dataLength: 100,
            dataType: 'VARCHAR',
            name: 'vendor',
            description:
              'Name of the manufacturer, wholesaler, or other vendor of the product.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product".vendor',
            ordinalPosition: 4,
            dataTypeDisplay: 'varchar',
            tags: [],
          },
          {
            dataType: 'TIMESTAMP',
            name: 'created_at',
            description:
              'Date (ISO 8601) and time (UTC) when the product was added to the store. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product".created_at',
            ordinalPosition: 5,
            dataTypeDisplay: 'timestamp',
            tags: [],
          },
          {
            dataType: 'TIMESTAMP',
            name: 'deleted_at',
            description:
              'Date (ISO 8601) and time (UTC) when the product was deleted. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product".deleted_at',
            ordinalPosition: 6,
            dataTypeDisplay: 'timestamp',
            tags: [],
          },
        ],
        displayName: 'dim.product',
        description:
          'This dimension table contains information about each of the products in your store. This table contains one row per product. This table reflects the current state of products in your Shopify admin.',
        customMetrics: [],
        tableType: 'Regular',
        database: {
          deleted: false,
          displayName: 'ecommerce_db',
          name: 'ecommerce_db',
          description:
            'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
          id: '722b65a4-9205-4f11-a62d-6a8902cdab39',
          type: 'database',
          fullyQualifiedName: 'sample_data.ecommerce_db',
        },
        columnNames: [
          'product_id',
          'shop_id',
          'title',
          'vendor',
          'created_at',
          'deleted_at',
        ],
        tier: null,
        totalVotes: 0,
        usageSummary: {
          date: '2024-02-02',
          weeklyStats: {
            percentileRank: 0,
            count: 0,
          },
          monthlyStats: {
            percentileRank: 0,
            count: 0,
          },
          dailyStats: {
            percentileRank: 0,
            count: 0,
          },
        },
        id: 'f65a4402-3e82-4238-b864-bc7c89bb2e2e',
        updatedAt: 1706855211762,
        owner: null,
        updatedBy: 'admin',
        entityType: 'table',
        dataProducts: [],
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.product"',
        version: 0.2,
        tags: [],
        followers: [],
        deleted: false,
        service: {
          deleted: false,
          displayName: 'sample_data',
          name: 'sample_data',
          id: '1e7f57b6-a165-410d-9962-1ccf54599cc7',
          type: 'databaseService',
          fullyQualifiedName: 'sample_data',
        },
        domain: null,
        name: 'dim.product',
        votes: {
          upVoters: [],
          downVoters: [],
          upVotes: 0,
          downVotes: 0,
        },
      },
      {
        databaseSchema: {
          deleted: false,
          displayName: 'shopify',
          name: 'shopify',
          description:
            'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
          id: '5cd86fad-873c-4e59-b9ff-a38967aac79d',
          type: 'databaseSchema',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
        },
        serviceType: 'BigQuery',
        lineage: [
          {
            toEntity: {
              fqn: 'sample_data.ecommerce_db.shopify."dim.product.variant"',
              id: 'd3e43ac3-8d05-45ed-9a30-94765dbfa7a3',
              type: 'table',
            },
            pipeline: {
              deleted: false,
              displayName: 'dim_product etl',
              name: 'dim_product_etl',
              description: 'diim_product ETL pipeline',
              id: '7b42caac-154c-4d1e-9da2-2a560979a8d7',
              type: 'pipeline',
              fullyQualifiedName: 'sample_airflow.dim_product_etl',
            },
            fromEntity: {
              fqn: 'sample_data.ecommerce_db.shopify.raw_customer',
              id: '1983c7f1-52fd-4dc7-89b9-29a8fffcfd6f',
              type: 'table',
            },
            sqlQuery:
              'create ecommerce_db.shopify."dim.product.variant" as select * from sample_data.ecommerce_db.shopify.raw_customer',
            description: null,
            source: 'Manual',
            doc_id:
              '1983c7f1-52fd-4dc7-89b9-29a8fffcfd6f-d3e43ac3-8d05-45ed-9a30-94765dbfa7a3',
          },
          {
            toEntity: {
              fqn: 'sample_data.ecommerce_db.shopify."dim.product.variant"',
              id: 'd3e43ac3-8d05-45ed-9a30-94765dbfa7a3',
              type: 'table',
            },
            pipeline: {
              deleted: false,
              displayName: 'dim_product etl',
              name: 'dim_product_etl',
              description: 'diim_product ETL pipeline',
              id: '7b42caac-154c-4d1e-9da2-2a560979a8d7',
              type: 'pipeline',
              fullyQualifiedName: 'sample_airflow.dim_product_etl',
            },
            fromEntity: {
              fqn: 'sample_data.ecommerce_db.shopify.raw_order',
              id: 'd26498fa-05cd-4e36-b7ba-f38a7a5fd372',
              type: 'table',
            },
            sqlQuery:
              'select * from sample_data.ecommerce_db.shopify.raw_order',
            description: null,
            source: 'Manual',
            doc_id:
              'd26498fa-05cd-4e36-b7ba-f38a7a5fd372-d3e43ac3-8d05-45ed-9a30-94765dbfa7a3',
          },
        ],
        columns: [
          {
            dataType: 'NUMERIC',
            name: 'product_variant_id',
            description:
              'The ID of the product variant. This column is the primary key for this table.',
            constraint: 'PRIMARY_KEY',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product.variant".product_variant_id',
            ordinalPosition: 1,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataType: 'NUMERIC',
            name: 'product_id',
            description:
              'The ID of the product. This column is a foreign key reference to the product_id column in dim.product table.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product.variant".product_id',
            ordinalPosition: 2,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataType: 'NUMERIC',
            name: 'shop_id',
            description:
              'The ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product.variant".shop_id',
            ordinalPosition: 3,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataLength: 100,
            dataType: 'VARCHAR',
            name: 'title',
            description: 'The title of the product variant.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product.variant".title',
            ordinalPosition: 4,
            dataTypeDisplay: 'varchar',
            tags: [],
          },
          {
            dataLength: 100,
            dataType: 'VARCHAR',
            name: 'barcode',
            description:
              'The Barcode, UPC, or ISBN number of the product variant.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product.variant".barcode',
            ordinalPosition: 5,
            dataTypeDisplay: 'varchar',
            tags: [],
          },
          {
            dataLength: 100,
            dataType: 'VARCHAR',
            name: 'sku',
            description: 'The SKU of the product variant.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product.variant".sku',
            ordinalPosition: 6,
            dataTypeDisplay: 'varchar',
            tags: [],
          },
          {
            dataType: 'NUMERIC',
            name: 'price',
            description:
              "The price of the product variant, in your store's currency.",
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product.variant".price',
            ordinalPosition: 7,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataType: 'NUMERIC',
            name: 'grams',
            description: 'Number of grams that the product variant weighs.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product.variant".grams',
            ordinalPosition: 8,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataType: 'TIMESTAMP',
            name: 'created_at',
            description:
              'The date (ISO 8601) and time (UTC) when the product variant was added to the store. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product.variant".created_at',
            ordinalPosition: 9,
            dataTypeDisplay: 'timestamp',
            tags: [],
          },
          {
            dataType: 'TIMESTAMP',
            name: 'deleted_at',
            description:
              'The date (ISO 8601) and time (UTC) when the product variant was deleted. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify."dim.product.variant".deleted_at',
            ordinalPosition: 10,
            dataTypeDisplay: 'timestamp',
            tags: [],
          },
        ],
        displayName: 'dim.product.variant',
        description:
          'This dimension table contains current information about each of the product variants in your store. This table contains one row per product variant.',
        customMetrics: [],
        tableType: 'Regular',
        database: {
          deleted: false,
          displayName: 'ecommerce_db',
          name: 'ecommerce_db',
          description:
            'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
          id: '722b65a4-9205-4f11-a62d-6a8902cdab39',
          type: 'database',
          fullyQualifiedName: 'sample_data.ecommerce_db',
        },
        columnNames: [
          'product_variant_id',
          'product_id',
          'shop_id',
          'title',
          'barcode',
          'sku',
          'price',
          'grams',
          'created_at',
          'deleted_at',
        ],
        tier: null,
        totalVotes: 0,
        usageSummary: {
          date: '2024-02-02',
          weeklyStats: {
            percentileRank: 0,
            count: 0,
          },
          monthlyStats: {
            percentileRank: 0,
            count: 0,
          },
          dailyStats: {
            percentileRank: 0,
            count: 0,
          },
        },
        id: 'd3e43ac3-8d05-45ed-9a30-94765dbfa7a3',
        updatedAt: 1706855210105,
        owner: null,
        updatedBy: 'admin',
        entityType: 'table',
        dataProducts: [],
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify."dim.product.variant"',
        version: 0.2,
        tags: [],
        followers: [],
        deleted: false,
        service: {
          deleted: false,
          displayName: 'sample_data',
          name: 'sample_data',
          id: '1e7f57b6-a165-410d-9962-1ccf54599cc7',
          type: 'databaseService',
          fullyQualifiedName: 'sample_data',
        },
        domain: null,
        name: 'dim.product.variant',
        votes: {
          upVoters: [],
          downVoters: [],
          upVotes: 0,
          downVotes: 0,
        },
      },
      {
        databaseSchema: {
          deleted: false,
          displayName: 'shopify',
          name: 'shopify',
          description:
            'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
          id: '5cd86fad-873c-4e59-b9ff-a38967aac79d',
          type: 'databaseSchema',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
        },
        serviceType: 'BigQuery',
        lineage: [
          {
            toEntity: {
              fqn: 'sample_data.ecommerce_db.shopify.fact_order',
              id: '6364831b-6860-4b8a-b4a1-5de1840cf4f9',
              type: 'table',
            },
            pipeline: {
              deleted: false,
              name: 'update_fact_order_from_raw_order',
              description:
                'Procedure to update fact order from raw order table',
              id: 'a9a403bd-b74d-47cc-893d-b1de99658748',
              type: 'storedProcedure',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.update_fact_order_from_raw_order',
            },
            fromEntity: {
              fqn: 'sample_data.ecommerce_db.shopify.raw_order',
              id: 'd26498fa-05cd-4e36-b7ba-f38a7a5fd372',
              type: 'table',
            },
            sqlQuery: null,
            description: null,
            source: 'Manual',
            doc_id:
              'd26498fa-05cd-4e36-b7ba-f38a7a5fd372-6364831b-6860-4b8a-b4a1-5de1840cf4f9',
          },
          {
            toEntity: {
              fqn: 'sample_data.ecommerce_db.shopify."dim.product.variant"',
              id: 'd3e43ac3-8d05-45ed-9a30-94765dbfa7a3',
              type: 'table',
            },
            pipeline: {
              deleted: false,
              displayName: 'dim_product etl',
              name: 'dim_product_etl',
              description: 'diim_product ETL pipeline',
              id: '7b42caac-154c-4d1e-9da2-2a560979a8d7',
              type: 'pipeline',
              fullyQualifiedName: 'sample_airflow.dim_product_etl',
            },
            fromEntity: {
              fqn: 'sample_data.ecommerce_db.shopify.raw_order',
              id: 'd26498fa-05cd-4e36-b7ba-f38a7a5fd372',
              type: 'table',
            },
            sqlQuery:
              'select * from sample_data.ecommerce_db.shopify.raw_order',
            description: null,
            source: 'Manual',
            doc_id:
              'd26498fa-05cd-4e36-b7ba-f38a7a5fd372-d3e43ac3-8d05-45ed-9a30-94765dbfa7a3',
          },
          {
            toEntity: {
              fqn: 'sample_data.ecommerce_db.shopify."dim.product"',
              id: 'f65a4402-3e82-4238-b864-bc7c89bb2e2e',
              type: 'table',
            },
            pipeline: {
              deleted: false,
              displayName: 'dim_product etl',
              name: 'dim_product_etl',
              description: 'diim_product ETL pipeline',
              id: '7b42caac-154c-4d1e-9da2-2a560979a8d7',
              type: 'pipeline',
              fullyQualifiedName: 'sample_airflow.dim_product_etl',
            },
            fromEntity: {
              fqn: 'sample_data.ecommerce_db.shopify.raw_order',
              id: 'd26498fa-05cd-4e36-b7ba-f38a7a5fd372',
              type: 'table',
            },
            sqlQuery:
              'select * from sample_data.ecommerce_db.shopify.raw_order',
            description: null,
            source: 'Manual',
            doc_id:
              'd26498fa-05cd-4e36-b7ba-f38a7a5fd372-f65a4402-3e82-4238-b864-bc7c89bb2e2e',
          },
        ],
        columns: [
          {
            dataLength: 1,
            dataType: 'STRING',
            name: 'comments',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_order.comments',
            ordinalPosition: 1,
            dataTypeDisplay: 'string',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'STRING',
            name: 'creditcard',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_order.creditcard',
            ordinalPosition: 2,
            dataTypeDisplay: 'string',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'STRING',
            name: 'membership',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_order.membership',
            ordinalPosition: 4,
            dataTypeDisplay: 'string',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'ARRAY',
            name: 'orders',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_order.orders',
            ordinalPosition: 5,
            dataTypeDisplay:
              'array<struct<product_id:character varying(24),price:int,onsale:boolean,tax:int,weight:int,others:int,vendor:character varying(64)>>',
            arrayDataType: 'STRUCT',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'STRING',
            name: 'platform',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_order.platform',
            ordinalPosition: 6,
            dataTypeDisplay: 'string',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'MAP',
            name: 'preference',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_order.preference',
            ordinalPosition: 7,
            dataTypeDisplay: 'map<character varying(32),boolean>',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'ARRAY',
            name: 'shipping_address',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_order.shipping_address',
            ordinalPosition: 8,
            dataTypeDisplay:
              'array<struct<name:character varying(32),street_address:character varying(128),city:character varying(32),postcode:character varying(8)>>',
            arrayDataType: 'STRUCT',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'STRING',
            name: 'shipping_date',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_order.shipping_date',
            ordinalPosition: 9,
            dataTypeDisplay: 'string',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'STRING',
            name: 'transaction_date',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_order.transaction_date',
            ordinalPosition: 10,
            dataTypeDisplay: 'string',
            tags: [],
          },
          {
            dataType: 'NUMERIC',
            name: 'total_order_count',
            description:
              'The total number of orders that the customer has made from this store across their lifetime.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_order.total_order_count',
            ordinalPosition: 11,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataType: 'NUMERIC',
            name: 'total_order_value',
            description:
              "The total amount of money that the customer has spent on orders from the store across their lifetime. The value is formatted in the store's currency.",
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_order.total_order_value',
            ordinalPosition: 12,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataType: 'TIMESTAMP',
            name: 'first_order_date',
            description:
              'The date (ISO 8601) and time (UTC) when the customer placed their first order. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_order.first_order_date',
            ordinalPosition: 13,
            dataTypeDisplay: 'timestamp',
            tags: [],
          },
          {
            dataType: 'TIMESTAMP',
            name: 'last_order_date',
            description:
              'The date (ISO 8601) and time (UTC) when the customer placed their most recent order. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_order.last_order_date',
            ordinalPosition: 14,
            dataTypeDisplay: 'timestamp',
            tags: [],
          },
        ],
        displayName: 'raw_order',
        description:
          'This is a raw orders table as represented in our online DB. This table contains all the orders by the customers and can be used to buid our dim and fact tables',
        customMetrics: [],
        tableType: 'Regular',
        database: {
          deleted: false,
          displayName: 'ecommerce_db',
          name: 'ecommerce_db',
          description:
            'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
          id: '722b65a4-9205-4f11-a62d-6a8902cdab39',
          type: 'database',
          fullyQualifiedName: 'sample_data.ecommerce_db',
        },
        columnNames: [
          'comments',
          'creditcard',
          'membership',
          'orders',
          'platform',
          'preference',
          'shipping_address',
          'shipping_date',
          'transaction_date',
          'total_order_count',
          'total_order_value',
          'first_order_date',
          'last_order_date',
        ],
        tier: null,
        totalVotes: 0,
        usageSummary: {
          date: '2024-02-02',
          weeklyStats: {
            percentileRank: 0,
            count: 0,
          },
          monthlyStats: {
            percentileRank: 0,
            count: 0,
          },
          dailyStats: {
            percentileRank: 0,
            count: 0,
          },
        },
        id: 'd26498fa-05cd-4e36-b7ba-f38a7a5fd372',
        updatedAt: 1706855211252,
        owner: null,
        updatedBy: 'admin',
        entityType: 'table',
        dataProducts: [],
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_order',
        version: 0.2,
        tags: [],
        followers: [],
        deleted: false,
        service: {
          deleted: false,
          displayName: 'sample_data',
          name: 'sample_data',
          id: '1e7f57b6-a165-410d-9962-1ccf54599cc7',
          type: 'databaseService',
          fullyQualifiedName: 'sample_data',
        },
        domain: null,
        name: 'raw_order',
        votes: {
          upVoters: [],
          downVoters: [],
          upVotes: 0,
          downVotes: 0,
        },
      },
      {
        databaseSchema: {
          deleted: false,
          displayName: 'shopify',
          name: 'shopify',
          description:
            'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
          id: '5cd86fad-873c-4e59-b9ff-a38967aac79d',
          type: 'databaseSchema',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
        },
        serviceType: 'BigQuery',
        lineage: [
          {
            toEntity: {
              fqn: 'sample_data.ecommerce_db.shopify.fact_order',
              id: '6364831b-6860-4b8a-b4a1-5de1840cf4f9',
              type: 'table',
            },
            pipeline: {
              deleted: false,
              name: 'update_fact_order_from_raw_order',
              description:
                'Procedure to update fact order from raw order table',
              id: 'a9a403bd-b74d-47cc-893d-b1de99658748',
              type: 'storedProcedure',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.update_fact_order_from_raw_order',
            },
            fromEntity: {
              fqn: 'sample_data.ecommerce_db.shopify.raw_order',
              id: 'd26498fa-05cd-4e36-b7ba-f38a7a5fd372',
              type: 'table',
            },
            sqlQuery: null,
            description: null,
            source: 'Manual',
            doc_id:
              'd26498fa-05cd-4e36-b7ba-f38a7a5fd372-6364831b-6860-4b8a-b4a1-5de1840cf4f9',
          },
        ],
        columns: [
          {
            dataType: 'NUMERIC',
            name: 'order_id',
            description:
              'Unique numeric identifier for the order across Shopify stores. In your Shopify admin, this ID is used internally. Most merchants are familiar with the other ID that appears on orders in the Shopify admin. This ID can be found in the Name column.',
            constraint: 'PRIMARY_KEY',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.fact_order.order_id',
            ordinalPosition: 1,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataType: 'NUMERIC',
            name: 'api_client_id',
            description:
              'The ID of the API client that called the Shopify API. This column is a foreign key reference to the api_client_id column in the dim_api_client table.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.fact_order.api_client_id',
            ordinalPosition: 2,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataType: 'NUMERIC',
            name: 'billing_address_id',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.fact_order.billing_address_id',
            ordinalPosition: 3,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataType: 'NUMERIC',
            name: 'customer_id',
            description:
              'The ID of the customer. This column is a foreign key reference to the customer_id column in the dim_customer table.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.fact_order.customer_id',
            ordinalPosition: 4,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataType: 'NUMERIC',
            name: 'location_id',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.fact_order.location_id',
            ordinalPosition: 5,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataType: 'NUMERIC',
            name: 'shipping_address_id',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.fact_order.shipping_address_id',
            ordinalPosition: 6,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataType: 'NUMERIC',
            name: 'shop_id',
            description:
              'The ID of the store. This column is a foreign key reference to the shop_id column in the dim.shop table.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.fact_order.shop_id',
            ordinalPosition: 7,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataType: 'NUMERIC',
            name: 'user_id',
            description:
              'The ID of the staff member who created the order. This column is a foreign key reference to the ID in the dim_staff table. This column applies to Shopify POS orders and to orders that were converted from draft orders.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.fact_order.user_id',
            ordinalPosition: 8,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataLength: 100,
            dataType: 'VARCHAR',
            name: 'name',
            description:
              'The identifier of the order that the merchant and customer sees. This is the ID that appears on the order in the Shopify admin. For example, #1001. By default, this identifier is unique to one store. If you have multiple stores, then use the order_id column to guarantee uniqueness across multiple stores.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.fact_order.name',
            ordinalPosition: 9,
            dataTypeDisplay: 'varchar',
            tags: [],
          },
          {
            dataType: 'NUMERIC',
            name: 'total_price',
            description:
              'The total price of the order, including shipping and taxes. This column includes gift card sales, but does not include returns. This value may not be accurate for API-imported orders. Do not use this column for financial calculations. Instead, use the total_price column in the sales table.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.fact_order.total_price',
            ordinalPosition: 10,
            dataTypeDisplay: 'numeric',
            tags: [],
          },
          {
            dataLength: 100,
            dataType: 'VARCHAR',
            name: 'discount_code',
            description: 'The discount code that was applied to the order.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.fact_order.discount_code',
            ordinalPosition: 11,
            dataTypeDisplay: 'varchar',
            tags: [],
          },
          {
            dataType: 'TIMESTAMP',
            name: 'processed_at',
            description:
              'The date (ISO 8601) and time (UTC) when the order was created. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.fact_order.processed_at',
            ordinalPosition: 12,
            dataTypeDisplay: 'timestamp',
            tags: [],
          },
          {
            dataType: 'TIMESTAMP',
            name: 'canceled_at',
            description:
              'If the order was canceled, then this column contains the date (ISO 8601) and time (UTC) when the order was canceled. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.fact_order.canceled_at',
            ordinalPosition: 13,
            dataTypeDisplay: 'timestamp',
            tags: [],
          },
          {
            dataType: 'TIMESTAMP',
            name: 'deleted_at',
            description:
              'If the order was deleted, then this column contains the date (ISO 8601) and time (UTC) when the order was deleted. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.fact_order.deleted_at',
            ordinalPosition: 14,
            dataTypeDisplay: 'timestamp',
            tags: [],
          },
          {
            dataType: 'BOOLEAN',
            name: 'test',
            description:
              'True when the order is a test order, False otherwise.',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.fact_order.test',
            ordinalPosition: 15,
            dataTypeDisplay: 'boolean',
            tags: [],
          },
        ],
        displayName: 'fact_order',
        description:
          'The orders table contains information about each order in your store. Although this table is good for generating order lists and joining with the dim_customer, use the sales table instead for computing financial or other metrics.',
        customMetrics: [],
        tableType: 'Regular',
        database: {
          deleted: false,
          displayName: 'ecommerce_db',
          name: 'ecommerce_db',
          description:
            'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
          id: '722b65a4-9205-4f11-a62d-6a8902cdab39',
          type: 'database',
          fullyQualifiedName: 'sample_data.ecommerce_db',
        },
        columnNames: [
          'order_id',
          'api_client_id',
          'billing_address_id',
          'customer_id',
          'location_id',
          'shipping_address_id',
          'shop_id',
          'user_id',
          'name',
          'total_price',
          'discount_code',
          'processed_at',
          'canceled_at',
          'deleted_at',
          'test',
        ],
        tier: null,
        totalVotes: 0,
        usageSummary: {
          date: '2024-02-02',
          weeklyStats: {
            percentileRank: 0,
            count: 0,
          },
          monthlyStats: {
            percentileRank: 0,
            count: 0,
          },
          dailyStats: {
            percentileRank: 0,
            count: 0,
          },
        },
        id: '6364831b-6860-4b8a-b4a1-5de1840cf4f9',
        updatedAt: 1706855210286,
        owner: null,
        updatedBy: 'admin',
        entityType: 'table',
        dataProducts: [],
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_order',
        version: 0.2,
        tags: [],
        followers: [],
        deleted: false,
        service: {
          deleted: false,
          displayName: 'sample_data',
          name: 'sample_data',
          id: '1e7f57b6-a165-410d-9962-1ccf54599cc7',
          type: 'databaseService',
          fullyQualifiedName: 'sample_data',
        },
        domain: null,
        name: 'fact_order',
        votes: {
          upVoters: [],
          downVoters: [],
          upVotes: 0,
          downVotes: 0,
        },
      },
    ],
    edges: [
      {
        toEntity: {
          fqn: 'sample_data.ecommerce_db.shopify.fact_order',
          id: '6364831b-6860-4b8a-b4a1-5de1840cf4f9',
          type: 'table',
        },
        pipeline: {
          deleted: false,
          name: 'update_fact_order_from_raw_order',
          description: 'Procedure to update fact order from raw order table',
          id: 'a9a403bd-b74d-47cc-893d-b1de99658748',
          type: 'storedProcedure',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.update_fact_order_from_raw_order',
        },
        fromEntity: {
          fqn: 'sample_data.ecommerce_db.shopify.raw_order',
          id: 'd26498fa-05cd-4e36-b7ba-f38a7a5fd372',
          type: 'table',
        },
        sqlQuery: null,
        description: null,
        source: 'Manual',
        doc_id:
          'd26498fa-05cd-4e36-b7ba-f38a7a5fd372-6364831b-6860-4b8a-b4a1-5de1840cf4f9',
      },
      {
        toEntity: {
          fqn: 'sample_data.ecommerce_db.shopify."dim.product.variant"',
          id: 'd3e43ac3-8d05-45ed-9a30-94765dbfa7a3',
          type: 'table',
        },
        pipeline: {
          deleted: false,
          displayName: 'dim_product etl',
          name: 'dim_product_etl',
          description: 'diim_product ETL pipeline',
          id: '7b42caac-154c-4d1e-9da2-2a560979a8d7',
          type: 'pipeline',
          fullyQualifiedName: 'sample_airflow.dim_product_etl',
        },
        fromEntity: {
          fqn: 'sample_data.ecommerce_db.shopify.raw_order',
          id: 'd26498fa-05cd-4e36-b7ba-f38a7a5fd372',
          type: 'table',
        },
        sqlQuery: 'select * from sample_data.ecommerce_db.shopify.raw_order',
        description: null,
        source: 'Manual',
        doc_id:
          'd26498fa-05cd-4e36-b7ba-f38a7a5fd372-d3e43ac3-8d05-45ed-9a30-94765dbfa7a3',
      },
      {
        toEntity: {
          fqn: 'sample_data.ecommerce_db.shopify."dim.product"',
          id: 'f65a4402-3e82-4238-b864-bc7c89bb2e2e',
          type: 'table',
        },
        pipeline: {
          deleted: false,
          displayName: 'dim_product etl',
          name: 'dim_product_etl',
          description: 'diim_product ETL pipeline',
          id: '7b42caac-154c-4d1e-9da2-2a560979a8d7',
          type: 'pipeline',
          fullyQualifiedName: 'sample_airflow.dim_product_etl',
        },
        fromEntity: {
          fqn: 'sample_data.ecommerce_db.shopify.raw_order',
          id: 'd26498fa-05cd-4e36-b7ba-f38a7a5fd372',
          type: 'table',
        },
        sqlQuery: 'select * from sample_data.ecommerce_db.shopify.raw_order',
        description: null,
        source: 'Manual',
        doc_id:
          'd26498fa-05cd-4e36-b7ba-f38a7a5fd372-f65a4402-3e82-4238-b864-bc7c89bb2e2e',
      },
    ],
    entity: {
      databaseSchema: {
        deleted: false,
        displayName: 'shopify',
        name: 'shopify',
        description:
          'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
        id: '5cd86fad-873c-4e59-b9ff-a38967aac79d',
        type: 'databaseSchema',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      },
      serviceType: 'BigQuery',
      lineage: [
        {
          toEntity: {
            fqn: 'sample_data.ecommerce_db.shopify.fact_order',
            id: '6364831b-6860-4b8a-b4a1-5de1840cf4f9',
            type: 'table',
          },
          pipeline: {
            deleted: false,
            name: 'update_fact_order_from_raw_order',
            description: 'Procedure to update fact order from raw order table',
            id: 'a9a403bd-b74d-47cc-893d-b1de99658748',
            type: 'storedProcedure',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.update_fact_order_from_raw_order',
          },
          fromEntity: {
            fqn: 'sample_data.ecommerce_db.shopify.raw_order',
            id: 'd26498fa-05cd-4e36-b7ba-f38a7a5fd372',
            type: 'table',
          },
          sqlQuery: null,
          description: null,
          source: 'Manual',
          doc_id:
            'd26498fa-05cd-4e36-b7ba-f38a7a5fd372-6364831b-6860-4b8a-b4a1-5de1840cf4f9',
        },
        {
          toEntity: {
            fqn: 'sample_data.ecommerce_db.shopify."dim.product.variant"',
            id: 'd3e43ac3-8d05-45ed-9a30-94765dbfa7a3',
            type: 'table',
          },
          pipeline: {
            deleted: false,
            displayName: 'dim_product etl',
            name: 'dim_product_etl',
            description: 'diim_product ETL pipeline',
            id: '7b42caac-154c-4d1e-9da2-2a560979a8d7',
            type: 'pipeline',
            fullyQualifiedName: 'sample_airflow.dim_product_etl',
          },
          fromEntity: {
            fqn: 'sample_data.ecommerce_db.shopify.raw_order',
            id: 'd26498fa-05cd-4e36-b7ba-f38a7a5fd372',
            type: 'table',
          },
          sqlQuery: 'select * from sample_data.ecommerce_db.shopify.raw_order',
          description: null,
          source: 'Manual',
          doc_id:
            'd26498fa-05cd-4e36-b7ba-f38a7a5fd372-d3e43ac3-8d05-45ed-9a30-94765dbfa7a3',
        },
        {
          toEntity: {
            fqn: 'sample_data.ecommerce_db.shopify."dim.product"',
            id: 'f65a4402-3e82-4238-b864-bc7c89bb2e2e',
            type: 'table',
          },
          pipeline: {
            deleted: false,
            displayName: 'dim_product etl',
            name: 'dim_product_etl',
            description: 'diim_product ETL pipeline',
            id: '7b42caac-154c-4d1e-9da2-2a560979a8d7',
            type: 'pipeline',
            fullyQualifiedName: 'sample_airflow.dim_product_etl',
          },
          fromEntity: {
            fqn: 'sample_data.ecommerce_db.shopify.raw_order',
            id: 'd26498fa-05cd-4e36-b7ba-f38a7a5fd372',
            type: 'table',
          },
          sqlQuery: 'select * from sample_data.ecommerce_db.shopify.raw_order',
          description: null,
          source: 'Manual',
          doc_id:
            'd26498fa-05cd-4e36-b7ba-f38a7a5fd372-f65a4402-3e82-4238-b864-bc7c89bb2e2e',
        },
      ],
      columns: [
        {
          dataLength: 1,
          dataType: 'STRING',
          name: 'comments',
          constraint: 'NULL',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_order.comments',
          ordinalPosition: 1,
          dataTypeDisplay: 'string',
          tags: [],
        },
        {
          dataLength: 1,
          dataType: 'STRING',
          name: 'creditcard',
          constraint: 'NULL',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_order.creditcard',
          ordinalPosition: 2,
          dataTypeDisplay: 'string',
          tags: [],
        },
        {
          dataLength: 1,
          dataType: 'STRING',
          name: 'membership',
          constraint: 'NULL',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_order.membership',
          ordinalPosition: 4,
          dataTypeDisplay: 'string',
          tags: [],
        },
        {
          dataLength: 1,
          dataType: 'ARRAY',
          name: 'orders',
          constraint: 'NULL',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_order.orders',
          ordinalPosition: 5,
          dataTypeDisplay:
            'array<struct<product_id:character varying(24),price:int,onsale:boolean,tax:int,weight:int,others:int,vendor:character varying(64)>>',
          arrayDataType: 'STRUCT',
          tags: [],
        },
        {
          dataLength: 1,
          dataType: 'STRING',
          name: 'platform',
          constraint: 'NULL',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_order.platform',
          ordinalPosition: 6,
          dataTypeDisplay: 'string',
          tags: [],
        },
        {
          dataLength: 1,
          dataType: 'MAP',
          name: 'preference',
          constraint: 'NULL',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_order.preference',
          ordinalPosition: 7,
          dataTypeDisplay: 'map<character varying(32),boolean>',
          tags: [],
        },
        {
          dataLength: 1,
          dataType: 'ARRAY',
          name: 'shipping_address',
          constraint: 'NULL',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_order.shipping_address',
          ordinalPosition: 8,
          dataTypeDisplay:
            'array<struct<name:character varying(32),street_address:character varying(128),city:character varying(32),postcode:character varying(8)>>',
          arrayDataType: 'STRUCT',
          tags: [],
        },
        {
          dataLength: 1,
          dataType: 'STRING',
          name: 'shipping_date',
          constraint: 'NULL',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_order.shipping_date',
          ordinalPosition: 9,
          dataTypeDisplay: 'string',
          tags: [],
        },
        {
          dataLength: 1,
          dataType: 'STRING',
          name: 'transaction_date',
          constraint: 'NULL',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_order.transaction_date',
          ordinalPosition: 10,
          dataTypeDisplay: 'string',
          tags: [],
        },
        {
          dataType: 'NUMERIC',
          name: 'total_order_count',
          description:
            'The total number of orders that the customer has made from this store across their lifetime.',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_order.total_order_count',
          ordinalPosition: 11,
          dataTypeDisplay: 'numeric',
          tags: [],
        },
        {
          dataType: 'NUMERIC',
          name: 'total_order_value',
          description:
            "The total amount of money that the customer has spent on orders from the store across their lifetime. The value is formatted in the store's currency.",
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_order.total_order_value',
          ordinalPosition: 12,
          dataTypeDisplay: 'numeric',
          tags: [],
        },
        {
          dataType: 'TIMESTAMP',
          name: 'first_order_date',
          description:
            'The date (ISO 8601) and time (UTC) when the customer placed their first order. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_order.first_order_date',
          ordinalPosition: 13,
          dataTypeDisplay: 'timestamp',
          tags: [],
        },
        {
          dataType: 'TIMESTAMP',
          name: 'last_order_date',
          description:
            'The date (ISO 8601) and time (UTC) when the customer placed their most recent order. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_order.last_order_date',
          ordinalPosition: 14,
          dataTypeDisplay: 'timestamp',
          tags: [],
        },
      ],
      displayName: 'raw_order',
      description:
        'This is a raw orders table as represented in our online DB. This table contains all the orders by the customers and can be used to buid our dim and fact tables',
      customMetrics: [],
      tableType: 'Regular',
      database: {
        deleted: false,
        displayName: 'ecommerce_db',
        name: 'ecommerce_db',
        description:
          'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
        id: '722b65a4-9205-4f11-a62d-6a8902cdab39',
        type: 'database',
        fullyQualifiedName: 'sample_data.ecommerce_db',
      },
      columnNames: [
        'comments',
        'creditcard',
        'membership',
        'orders',
        'platform',
        'preference',
        'shipping_address',
        'shipping_date',
        'transaction_date',
        'total_order_count',
        'total_order_value',
        'first_order_date',
        'last_order_date',
      ],
      tier: null,
      totalVotes: 0,
      usageSummary: {
        date: '2024-02-02',
        weeklyStats: {
          percentileRank: 0,
          count: 0,
        },
        monthlyStats: {
          percentileRank: 0,
          count: 0,
        },
        dailyStats: {
          percentileRank: 0,
          count: 0,
        },
      },
      id: 'd26498fa-05cd-4e36-b7ba-f38a7a5fd372',
      updatedAt: 1706855211252,
      owner: null,
      updatedBy: 'admin',
      entityType: 'table',
      dataProducts: [],
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_order',
      version: 0.2,
      tags: [],
      followers: [],
      deleted: false,
      service: {
        deleted: false,
        displayName: 'sample_data',
        name: 'sample_data',
        id: '1e7f57b6-a165-410d-9962-1ccf54599cc7',
        type: 'databaseService',
        fullyQualifiedName: 'sample_data',
      },
      domain: null,
      name: 'raw_order',
      votes: {
        upVoters: [],
        downVoters: [],
        upVotes: 0,
        downVotes: 0,
      },
    },
  },
  slashedTableName: [
    {
      name: 'bigquery',
      url: '/service/databaseServices/BigQuery/bigquery',
      imgSrc: '/service-icon-query.png',
    },
    {
      name: 'shopify',
      url: '/database/bigquery.shopify',
    },
    {
      name: 'dim_address',
      url: '',
      activeTitle: true,
    },
  ],
  tableDetails: {
    id: '9d664bbd-8c9e-4068-9112-9ab0457d4c52',
    name: 'dim_address',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
    description:
      'This dimension table contains the billing and shipping addresses of customers. You can join this table with the sales table to generate lists of the billing and shipping addresses. Customers can enter their addresses more than once, so the same address can appear in more than one row in this table. This table contains one row per customer address.',
    version: 0.1,
    updatedAt: 1682049945635,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/tables/9d664bbd-8c9e-4068-9112-9ab0457d4c52',
    tableType: 'Regular',
    columns: [
      {
        name: 'address_id',
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
        description: 'Unique identifier for the address.',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address.address_id',
        tags: [],
        ordinalPosition: 1,
      },
      {
        name: 'shop_id',
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
        description:
          'The ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address.shop_id',
        tags: [],
        ordinalPosition: 2,
      },
      {
        name: 'first_name',
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'First name of the customer.',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address.first_name',
        tags: [],
        ordinalPosition: 3,
      },
      {
        name: 'last_name',
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Last name of the customer.',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address.last_name',
        tags: [],
        ordinalPosition: 4,
      },
      {
        name: 'address1',
        dataType: 'VARCHAR',
        dataLength: 500,
        dataTypeDisplay: 'varchar',
        description: 'The first address line. For example, 150 Elgin St.',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address.address1',
        tags: [],
        ordinalPosition: 5,
      },
      {
        name: 'address2',
        dataType: 'VARCHAR',
        dataLength: 500,
        dataTypeDisplay: 'varchar',
        description: 'The second address line. For example, Suite 800.',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address.address2',
        tags: [],
        ordinalPosition: 6,
      },
      {
        name: 'company',
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: "The name of the customer's business, if one exists.",
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address.company',
        tags: [],
        ordinalPosition: 7,
      },
      {
        name: 'city',
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'The name of the city. For example, Palo Alto.',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address.city',
        tags: [],
        ordinalPosition: 8,
      },
      {
        name: 'region',
        dataType: 'VARCHAR',
        dataLength: 512,
        dataTypeDisplay: 'varchar',
        description:
          'The name of the region, such as a province or state, where the customer is located. For example, Ontario or New York. This column is the same as CustomerAddress.province in the Admin API.',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address.region',
        tags: [],
        ordinalPosition: 9,
      },
      {
        name: 'zip',
        dataType: 'VARCHAR',
        dataLength: 10,
        dataTypeDisplay: 'varchar',
        description: 'The ZIP or postal code. For example, 90210.',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address.zip',
        tags: [],
        ordinalPosition: 10,
      },
      {
        name: 'country',
        dataType: 'VARCHAR',
        dataLength: 50,
        dataTypeDisplay: 'varchar',
        description: 'The full name of the country. For example, Canada.',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address.country',
        tags: [],
        ordinalPosition: 11,
      },
      {
        name: 'phone',
        dataType: 'VARCHAR',
        dataLength: 15,
        dataTypeDisplay: 'varchar',
        description: 'The phone number of the customer.',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address.phone',
        tags: [],
        ordinalPosition: 12,
      },
    ],
    tableConstraints: [
      { constraintType: 'PRIMARY_KEY', columns: ['address_id', 'shop_id'] },
    ],
    databaseSchema: {
      id: 'be37a61e-fb10-4748-86ab-0714613a42ea',
      type: 'databaseSchema',
      name: 'shopify',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      deleted: false,
      href: 'http://localhost:8585/api/v1/databaseSchemas/be37a61e-fb10-4748-86ab-0714613a42ea',
    },
    database: {
      id: '0dac7caf-8419-4a0b-a96e-345730b2c0f5',
      type: 'database',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      deleted: false,
      href: 'http://localhost:8585/api/v1/databases/0dac7caf-8419-4a0b-a96e-345730b2c0f5',
    },
    service: {
      id: 'f24cd129-f864-45d9-8cce-46a9aecd6846',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      deleted: false,
      href: 'http://localhost:8585/api/v1/services/databaseServices/f24cd129-f864-45d9-8cce-46a9aecd6846',
    },
    serviceType: 'BigQuery',
    tags: [],
    usageSummary: {
      dailyStats: { count: 0, percentileRank: 0.0 },
      weeklyStats: { count: 0, percentileRank: 0.0 },
      monthlyStats: { count: 0, percentileRank: 0.0 },
      date: '2023-04-21',
    },
    followers: [],
    joins: {
      startDate: '2023-03-22',
      dayCount: 30,
      columnJoins: [],
      directTableJoins: [],
    },
    deleted: false,
  },
};

export const mockSearchData = {
  took: 141,
  timed_out: false,
  _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
  hits: {
    total: { value: 4, relation: 'eq' },
    max_score: 12.495619,
    hits: [
      {
        _index: 'table_search_index',
        _type: '_doc',
        _id: '9d664bbd-8c9e-4068-9112-9ab0457d4c52',
        _score: 12.495619,
        _source: {
          id: '9d664bbd-8c9e-4068-9112-9ab0457d4c52',
          name: 'dim_address',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
          description:
            'This dimension table contains the billing and shipping addresses of customers. You can join this table with the sales table to generate lists of the billing and shipping addresses. Customers can enter their addresses more than once, so the same address can appear in more than one row in this table. This table contains one row per customer address.',
          version: 0.1,
          updatedAt: 1682049945635,
          updatedBy: 'admin',
          href: 'http://openmetadata-server:8585/api/v1/tables/9d664bbd-8c9e-4068-9112-9ab0457d4c52',
          tableType: 'Regular',
          columns: [
            {
              name: 'address_id',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description: 'Unique identifier for the address.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.address_id',
              tags: [],
              ordinalPosition: 1,
            },
            {
              name: 'shop_id',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description:
                'The ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.shop_id',
              tags: [],
              ordinalPosition: 2,
            },
            {
              name: 'first_name',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description: 'First name of the customer.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.first_name',
              tags: [],
              ordinalPosition: 3,
            },
            {
              name: 'last_name',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description: 'Last name of the customer.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.last_name',
              tags: [],
              ordinalPosition: 4,
            },
            {
              name: 'address1',
              dataType: 'VARCHAR',
              dataLength: 500,
              dataTypeDisplay: 'varchar',
              description: 'The first address line. For example, 150 Elgin St.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.address1',
              tags: [],
              ordinalPosition: 5,
            },
            {
              name: 'address2',
              dataType: 'VARCHAR',
              dataLength: 500,
              dataTypeDisplay: 'varchar',
              description: 'The second address line. For example, Suite 800.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.address2',
              tags: [],
              ordinalPosition: 6,
            },
            {
              name: 'company',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description:
                "The name of the customer's business, if one exists.",
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.company',
              tags: [],
              ordinalPosition: 7,
            },
            {
              name: 'city',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description: 'The name of the city. For example, Palo Alto.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.city',
              tags: [],
              ordinalPosition: 8,
            },
            {
              name: 'region',
              dataType: 'VARCHAR',
              dataLength: 512,
              dataTypeDisplay: 'varchar',
              description:
                'The name of the region, such as a province or state, where the customer is located. For example, Ontario or New York. This column is the same as CustomerAddress.province in the Admin API.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.region',
              tags: [],
              ordinalPosition: 9,
            },
            {
              name: 'zip',
              dataType: 'VARCHAR',
              dataLength: 10,
              dataTypeDisplay: 'varchar',
              description: 'The ZIP or postal code. For example, 90210.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.zip',
              tags: [],
              ordinalPosition: 10,
            },
            {
              name: 'country',
              dataType: 'VARCHAR',
              dataLength: 50,
              dataTypeDisplay: 'varchar',
              description: 'The full name of the country. For example, Canada.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.country',
              tags: [],
              ordinalPosition: 11,
            },
            {
              name: 'phone',
              dataType: 'VARCHAR',
              dataLength: 15,
              dataTypeDisplay: 'varchar',
              description: 'The phone number of the customer.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.phone',
              tags: [],
              ordinalPosition: 12,
            },
          ],
          tableConstraints: [
            {
              constraintType: 'PRIMARY_KEY',
              columns: ['address_id', 'shop_id'],
            },
          ],
          databaseSchema: {
            id: 'be37a61e-fb10-4748-86ab-0714613a42ea',
            type: 'databaseSchema',
            name: 'shopify',
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
            description:
              'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
            deleted: false,
            href: 'http://openmetadata-server:8585/api/v1/databaseSchemas/be37a61e-fb10-4748-86ab-0714613a42ea',
          },
          database: {
            id: '0dac7caf-8419-4a0b-a96e-345730b2c0f5',
            type: 'database',
            name: 'ecommerce_db',
            fullyQualifiedName: 'sample_data.ecommerce_db',
            description:
              'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
            deleted: false,
            href: 'http://openmetadata-server:8585/api/v1/databases/0dac7caf-8419-4a0b-a96e-345730b2c0f5',
          },
          service: {
            id: 'f24cd129-f864-45d9-8cce-46a9aecd6846',
            type: 'databaseService',
            name: 'sample_data',
            fullyQualifiedName: 'sample_data',
            deleted: false,
            href: 'http://openmetadata-server:8585/api/v1/services/databaseServices/f24cd129-f864-45d9-8cce-46a9aecd6846',
          },
          serviceType: 'BigQuery',
          tags: [],
          deleted: false,
          displayName: 'dim_address',
          tier: null,
          followers: [],
          suggest: [
            {
              input: 'sample_data.ecommerce_db.shopify.dim_address',
              weight: 5,
            },
            { input: 'dim_address', weight: 10 },
            { input: 'ecommerce_db.shopify.dim_address', weight: 5 },
            { input: 'shopify.dim_address', weight: 5 },
          ],
          service_suggest: [{ input: 'sample_data', weight: 5 }],
          column_suggest: [
            { input: 'address_id', weight: 5 },
            { input: 'shop_id', weight: 5 },
            { input: 'first_name', weight: 5 },
            { input: 'last_name', weight: 5 },
            { input: 'address1', weight: 5 },
            { input: 'address2', weight: 5 },
            { input: 'company', weight: 5 },
            { input: 'city', weight: 5 },
            { input: 'region', weight: 5 },
            { input: 'zip', weight: 5 },
            { input: 'country', weight: 5 },
            { input: 'phone', weight: 5 },
          ],
          schema_suggest: [{ input: 'shopify', weight: 5 }],
          database_suggest: [{ input: 'ecommerce_db', weight: 5 }],
          entityType: 'table',
        },
        highlight: {
          'columns.description': [
            'This column is a foreign key reference to the shop_id column in the <span class="text-highlighter">dim</span>_shop table.',
          ],
          displayName: ['<span class="text-highlighter">dim</span>_address'],
        },
      },
      {
        _index: 'table_search_index',
        _type: '_doc',
        _id: 'f1f03f22-24d6-4e88-a6bc-6aa0b03f0da0',
        _score: 10.606723,
        _source: {
          id: 'f1f03f22-24d6-4e88-a6bc-6aa0b03f0da0',
          name: 'dim_address_clean',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_address_clean',
          description: 'Created from dim_address after a small cleanup.',
          version: 0.1,
          updatedAt: 1682049945673,
          updatedBy: 'admin',
          href: 'http://openmetadata-server:8585/api/v1/tables/f1f03f22-24d6-4e88-a6bc-6aa0b03f0da0',
          tableType: 'Regular',
          columns: [
            {
              name: 'address_id',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description: 'Unique identifier for the address.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address_clean.address_id',
              tags: [],
              ordinalPosition: 1,
            },
            {
              name: 'shop_id',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description:
                'The ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address_clean.shop_id',
              tags: [],
              ordinalPosition: 2,
            },
            {
              name: 'first_name',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description: 'First name of the customer.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address_clean.first_name',
              tags: [],
              ordinalPosition: 3,
            },
            {
              name: 'last_name',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description: 'Last name of the customer.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address_clean.last_name',
              tags: [],
              ordinalPosition: 4,
            },
            {
              name: 'address',
              dataType: 'VARCHAR',
              dataLength: 500,
              dataTypeDisplay: 'varchar',
              description: 'Clean address',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address_clean.address',
              tags: [],
              ordinalPosition: 5,
            },
            {
              name: 'company',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description:
                "The name of the customer's business, if one exists.",
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address_clean.company',
              tags: [],
              ordinalPosition: 7,
            },
            {
              name: 'city',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description: 'The name of the city. For example, Palo Alto.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address_clean.city',
              tags: [],
              ordinalPosition: 8,
            },
            {
              name: 'region',
              dataType: 'VARCHAR',
              dataLength: 512,
              dataTypeDisplay: 'varchar',
              description:
                'The name of the region, such as a province or state, where the customer is located. For example, Ontario or New York. This column is the same as CustomerAddress.province in the Admin API.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address_clean.region',
              tags: [],
              ordinalPosition: 9,
            },
            {
              name: 'zip',
              dataType: 'VARCHAR',
              dataLength: 10,
              dataTypeDisplay: 'varchar',
              description: 'The ZIP or postal code. For example, 90210.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address_clean.zip',
              tags: [],
              ordinalPosition: 10,
            },
            {
              name: 'country',
              dataType: 'VARCHAR',
              dataLength: 50,
              dataTypeDisplay: 'varchar',
              description: 'The full name of the country. For example, Canada.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address_clean.country',
              tags: [],
              ordinalPosition: 11,
            },
            {
              name: 'phone',
              dataType: 'VARCHAR',
              dataLength: 15,
              dataTypeDisplay: 'varchar',
              description: 'The phone number of the customer.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address_clean.phone',
              tags: [],
              ordinalPosition: 12,
            },
          ],
          tableConstraints: [
            {
              constraintType: 'PRIMARY_KEY',
              columns: ['address_id', 'shop_id'],
            },
          ],
          databaseSchema: {
            id: 'be37a61e-fb10-4748-86ab-0714613a42ea',
            type: 'databaseSchema',
            name: 'shopify',
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
            description:
              'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
            deleted: false,
            href: 'http://openmetadata-server:8585/api/v1/databaseSchemas/be37a61e-fb10-4748-86ab-0714613a42ea',
          },
          database: {
            id: '0dac7caf-8419-4a0b-a96e-345730b2c0f5',
            type: 'database',
            name: 'ecommerce_db',
            fullyQualifiedName: 'sample_data.ecommerce_db',
            description:
              'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
            deleted: false,
            href: 'http://openmetadata-server:8585/api/v1/databases/0dac7caf-8419-4a0b-a96e-345730b2c0f5',
          },
          service: {
            id: 'f24cd129-f864-45d9-8cce-46a9aecd6846',
            type: 'databaseService',
            name: 'sample_data',
            fullyQualifiedName: 'sample_data',
            deleted: false,
            href: 'http://openmetadata-server:8585/api/v1/services/databaseServices/f24cd129-f864-45d9-8cce-46a9aecd6846',
          },
          serviceType: 'BigQuery',
          tags: [],
          deleted: false,
          displayName: 'dim_address_clean',
          tier: null,
          followers: [],
          suggest: [
            {
              input: 'sample_data.ecommerce_db.shopify.dim_address_clean',
              weight: 5,
            },
            { input: 'dim_address_clean', weight: 10 },
            { input: 'ecommerce_db.shopify.dim_address_clean', weight: 5 },
            { input: 'shopify.dim_address_clean', weight: 5 },
          ],
          service_suggest: [{ input: 'sample_data', weight: 5 }],
          column_suggest: [
            { input: 'address_id', weight: 5 },
            { input: 'shop_id', weight: 5 },
            { input: 'first_name', weight: 5 },
            { input: 'last_name', weight: 5 },
            { input: 'address', weight: 5 },
            { input: 'company', weight: 5 },
            { input: 'city', weight: 5 },
            { input: 'region', weight: 5 },
            { input: 'zip', weight: 5 },
            { input: 'country', weight: 5 },
            { input: 'phone', weight: 5 },
          ],
          schema_suggest: [{ input: 'shopify', weight: 5 }],
          database_suggest: [{ input: 'ecommerce_db', weight: 5 }],
          entityType: 'table',
        },
        highlight: {
          'columns.description': [
            'This column is a foreign key reference to the shop_id column in the <span class="text-highlighter">dim</span>_shop table.',
          ],
          displayName: [
            '<span class="text-highlighter">dim</span>_address_clean',
          ],
          description: [
            'Created from <span class="text-highlighter">dim</span>_address after a small cleanup.',
          ],
        },
      },
      {
        _index: 'table_search_index',
        _type: '_doc',
        _id: '94edd207-9d60-40cc-aa73-615e8fe20e97',
        _score: 4.081145,
        _source: {
          id: '94edd207-9d60-40cc-aa73-615e8fe20e97',
          name: 'fact_line_item',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_line_item',
          description:
            'The fact table contains information about the line items in orders. Each row in the table is a line item in an order. It contains product and product variant details as they were at the time of the order. This table does not include information about returns. Join this table with the TODO fact_sales table to get the details of the product on the day it was sold. This data will match what appears on the order in your Shopify admin as well as the in the Sales reports.',
          version: 0.1,
          updatedAt: 1682049945868,
          updatedBy: 'admin',
          href: 'http://openmetadata-server:8585/api/v1/tables/94edd207-9d60-40cc-aa73-615e8fe20e97',
          tableType: 'Regular',
          columns: [
            {
              name: 'line_item_id',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description:
                'ID of the line item. This column is the primary key for the this table.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.line_item_id',
              tags: [],
              constraint: 'PRIMARY_KEY',
              ordinalPosition: 1,
            },
            {
              name: 'billing_address_id',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.billing_address_id',
              tags: [],
              ordinalPosition: 2,
            },
            {
              name: 'order_id',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description:
                'ID of the order. This column is a foreign key reference to the orders_id column in the fact_order table.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.order_id',
              tags: [],
              ordinalPosition: 3,
            },
            {
              name: 'product_id',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description:
                'ID of the product ordered, unless the line item is for shipping costs (you can add custom items using a draft order). This column is a foreign key reference to the product_id column in the dim.product table.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.product_id',
              tags: [],
              ordinalPosition: 4,
            },
            {
              name: 'product_variant_id',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.product_variant_id',
              tags: [],
              ordinalPosition: 5,
            },
            {
              name: 'shop_id',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description:
                'ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.shop_id',
              tags: [],
              ordinalPosition: 6,
            },
            {
              name: 'name',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description:
                'Name of the line item. This name combines the product title and the variant title into the following format: product-title - variant-title. If there is no variant title, then the format is product-title. This column is the same as order.line_items.name"in the Admin API.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.name',
              tags: [],
              ordinalPosition: 7,
            },
            {
              name: 'product_title',
              dataType: 'VARCHAR',
              dataLength: 150,
              dataTypeDisplay: 'varchar',
              description:
                'Name of the product ordered. This column is the same as order.line_items.title in the Admin API.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.product_title',
              tags: [],
              ordinalPosition: 8,
            },
            {
              name: 'price',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description: 'Price of the product variant.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.price',
              tags: [],
              ordinalPosition: 9,
            },
            {
              name: 'quantity',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description:
                'Number of product variant items ordered in the line item.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.quantity',
              tags: [],
              ordinalPosition: 10,
            },
            {
              name: 'requires_shipping',
              dataType: 'BOOLEAN',
              dataTypeDisplay: 'boolean',
              description:
                "Whether the product variant requires fulfillment (shipping). For example, online gift cards don't require shipping.",
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.requires_shipping',
              tags: [],
              ordinalPosition: 11,
            },
            {
              name: 'taxable',
              dataType: 'BOOLEAN',
              dataTypeDisplay: 'boolean',
              description:
                'Whether taxes are charged for the product variant, otherwise contains 0. For example, when the line item is a gift card, taxes are not charged.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.taxable',
              tags: [],
              ordinalPosition: 12,
            },
            {
              name: 'gift_card',
              dataType: 'BOOLEAN',
              dataTypeDisplay: 'boolean',
              description: 'Whether the product variant is a gift card.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.gift_card',
              tags: [],
              ordinalPosition: 13,
            },
            {
              name: 'grams',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description:
                'Weight of a single unit of the product variant. Contains 0 when the product variant is a gift card.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.grams',
              tags: [],
              ordinalPosition: 14,
            },
            {
              name: 'product_vendor',
              dataType: 'VARCHAR',
              dataLength: 200,
              dataTypeDisplay: 'varchar',
              description:
                'Name of the manufacturer, wholesaler, or other vendor of the product.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.product_vendor',
              tags: [],
              ordinalPosition: 15,
            },
            {
              name: 'fulfillable_quantity',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description:
                'Number of product variant items in the line item that require fulfillment. Some product variants, such as gift cards and digital products, do not need to be fulfilled.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.fulfillable_quantity',
              tags: [],
              ordinalPosition: 16,
            },
            {
              name: 'fulfillment_service',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description:
                'Name of the fulfillment service provider that fulfilled (shipped) the variant ordered. Contains manual when there is no fulfillment service specified for the variant.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_line_item.fulfillment_service',
              tags: [],
              ordinalPosition: 17,
            },
          ],
          databaseSchema: {
            id: 'be37a61e-fb10-4748-86ab-0714613a42ea',
            type: 'databaseSchema',
            name: 'shopify',
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
            description:
              'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
            deleted: false,
            href: 'http://openmetadata-server:8585/api/v1/databaseSchemas/be37a61e-fb10-4748-86ab-0714613a42ea',
          },
          database: {
            id: '0dac7caf-8419-4a0b-a96e-345730b2c0f5',
            type: 'database',
            name: 'ecommerce_db',
            fullyQualifiedName: 'sample_data.ecommerce_db',
            description:
              'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
            deleted: false,
            href: 'http://openmetadata-server:8585/api/v1/databases/0dac7caf-8419-4a0b-a96e-345730b2c0f5',
          },
          service: {
            id: 'f24cd129-f864-45d9-8cce-46a9aecd6846',
            type: 'databaseService',
            name: 'sample_data',
            fullyQualifiedName: 'sample_data',
            deleted: false,
            href: 'http://openmetadata-server:8585/api/v1/services/databaseServices/f24cd129-f864-45d9-8cce-46a9aecd6846',
          },
          serviceType: 'BigQuery',
          tags: [],
          deleted: false,
          displayName: 'fact_line_item',
          tier: null,
          followers: [],
          suggest: [
            {
              input: 'sample_data.ecommerce_db.shopify.fact_line_item',
              weight: 5,
            },
            { input: 'fact_line_item', weight: 10 },
            { input: 'ecommerce_db.shopify.fact_line_item', weight: 5 },
            { input: 'shopify.fact_line_item', weight: 5 },
          ],
          service_suggest: [{ input: 'sample_data', weight: 5 }],
          column_suggest: [
            { input: 'line_item_id', weight: 5 },
            { input: 'billing_address_id', weight: 5 },
            { input: 'order_id', weight: 5 },
            { input: 'product_id', weight: 5 },
            { input: 'product_variant_id', weight: 5 },
            { input: 'shop_id', weight: 5 },
            { input: 'name', weight: 5 },
            { input: 'product_title', weight: 5 },
            { input: 'price', weight: 5 },
            { input: 'quantity', weight: 5 },
            { input: 'requires_shipping', weight: 5 },
            { input: 'taxable', weight: 5 },
            { input: 'gift_card', weight: 5 },
            { input: 'grams', weight: 5 },
            { input: 'product_vendor', weight: 5 },
            { input: 'fulfillable_quantity', weight: 5 },
            { input: 'fulfillment_service', weight: 5 },
          ],
          schema_suggest: [{ input: 'shopify', weight: 5 }],
          database_suggest: [{ input: 'ecommerce_db', weight: 5 }],
          entityType: 'table',
        },
        highlight: {
          'columns.description': [
            'ID of the product ordered, unless the line item is for shipping costs (you can <span class="text-highlighter">add</span> custom items using',
            'This column is a foreign key reference to the product_id column in the <span class="text-highlighter">dim</span>.product table.',
            'This column is a foreign key reference to the shop_id column in the <span class="text-highlighter">dim</span>_shop table.',
          ],
        },
      },
      {
        _index: 'table_search_index',
        _type: '_doc',
        _id: '4e3556eb-ac18-456e-b8ba-ea4a42dac422',
        _score: 4.081145,
        _source: {
          id: '4e3556eb-ac18-456e-b8ba-ea4a42dac422',
          name: 'fact_session',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_session',
          description:
            'This fact table contains information about the visitors to your online store. This table has one row per session, where one session can contain many page views. If you use Urchin Traffic Module (UTM) parameters in marketing campaigns, then you can use this table to track how many customers they direct to your store.',
          version: 0.1,
          updatedAt: 1682049945964,
          updatedBy: 'admin',
          href: 'http://openmetadata-server:8585/api/v1/tables/4e3556eb-ac18-456e-b8ba-ea4a42dac422',
          tableType: 'Regular',
          columns: [
            {
              name: 'derived_session_token',
              dataType: 'VARCHAR',
              dataLength: 200,
              dataTypeDisplay: 'varchar',
              description:
                'The ID of the visitor session. This column is the primary key for the table.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.derived_session_token',
              tags: [],
              constraint: 'PRIMARY_KEY',
              ordinalPosition: 1,
            },
            {
              name: 'shop_id',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description:
                'The ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.shop_id',
              tags: [],
              ordinalPosition: 2,
            },
            {
              name: 'session_duration',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description:
                'The time that the visitor spent in your store during the session. This value is the sum of the time spent on each page view (except for the last page viewed) during the session. The maximum value is 1800 seconds (30 minutes).',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.session_duration',
              tags: [],
              ordinalPosition: 3,
            },
            {
              name: 'count_of_pageviews',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description: 'The number of pages viewed during the session.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.count_of_pageviews',
              tags: [],
              ordinalPosition: 4,
            },
            {
              name: 'session_started_at',
              dataType: 'TIMESTAMP',
              dataTypeDisplay: 'timestamp',
              description:
                'The date (ISO 8601) and time (UTC) when this visitor session begins. It is the timestamp when the visitor first visits the store during this session. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.session_started_at',
              tags: [],
              ordinalPosition: 5,
            },
            {
              name: 'session_token',
              dataType: 'VARCHAR',
              dataLength: 200,
              dataTypeDisplay: 'varchar',
              description:
                'The ID of the session token that is created by the browser. A session token expires after 30 minutes of inactivity.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.session_token',
              tags: [],
              ordinalPosition: 6,
            },
            {
              name: 'user_token',
              dataType: 'VARCHAR',
              dataLength: 20,
              dataTypeDisplay: 'varchar',
              description:
                'The unique token assigned to the user. A user token expires after 2 years of inactivity.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.user_token',
              tags: [],
              constraint: 'UNIQUE',
              ordinalPosition: 7,
            },
            {
              name: 'landing_page_url',
              dataType: 'VARCHAR',
              dataLength: 1000,
              dataTypeDisplay: 'varchar',
              description:
                'The full URL of the first page visited during the session. For example, https://www.myshop.com/products/cool-tshirt?utm_source=Shop&utm_medium=....',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.landing_page_url',
              tags: [],
              ordinalPosition: 8,
            },
            {
              name: 'exit_page_path',
              dataType: 'VARCHAR',
              dataLength: 1000,
              dataTypeDisplay: 'varchar',
              description:
                'The path portion of the URL of the last page that the visitor visited during the session. This field is the same as exit_page_url except that it doesn’t contain the name of the store or any parameters. For example, /products/cool-tshirt.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.exit_page_path',
              tags: [],
              ordinalPosition: 9,
            },
            {
              name: 'exit_page_url',
              dataType: 'VARCHAR',
              dataLength: 1000,
              dataTypeDisplay: 'varchar',
              description:
                'The full URL of the last page that the visitor visited during the session. For example, https://www.myshop.com/products/cool-tshirt?utm_source=Shop&utm_medium=....',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.exit_page_url',
              tags: [],
              ordinalPosition: 10,
            },
            {
              name: 'referrer_tld',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description:
                'The top-level domain of the referring website. For example, if the hostname is www.facebook.com, then the referrer_tld is com.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.referrer_tld',
              tags: [],
              ordinalPosition: 11,
            },
            {
              name: 'ua_browser',
              dataType: 'VARCHAR',
              dataLength: 200,
              dataTypeDisplay: 'varchar',
              description:
                'The name of the browser that the visitor used. For example, Mobile Safari, Chrome.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.ua_browser',
              tags: [],
              ordinalPosition: 12,
            },
            {
              name: 'ua_raw',
              dataType: 'VARCHAR',
              dataLength: 2000,
              dataTypeDisplay: 'varchar',
              description:
                'The string that identifies the user agent of the user. User agent shows data about the operating system and device that a visitor uses to browse your store.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.ua_raw',
              tags: [],
              ordinalPosition: 13,
            },
            {
              name: 'count_of_orders_completed',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description: 'The number of orders created during the session.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.count_of_orders_completed',
              tags: [],
              ordinalPosition: 14,
            },
            {
              name: 'completed_first_order_at',
              dataType: 'TIMESTAMP',
              dataTypeDisplay: 'timestamp',
              description:
                'The date (ISO 8601) and time (UTC) when the visitor completes their first order during this session. Contains NULL if the visitor never completes an order during this session. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.completed_first_order_at',
              tags: [],
              ordinalPosition: 15,
            },
            {
              name: 'hit_first_checkout_at',
              dataType: 'TIMESTAMP',
              dataTypeDisplay: 'timestamp',
              description:
                'The date (ISO 8601) and time (UTC) when the visitor first visits the checkout page during this session. Contains NULL if the visitor never visits the checkout page during the session. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.hit_first_checkout_at',
              tags: [],
              ordinalPosition: 16,
            },
            {
              name: 'started_first_checkout_at',
              dataType: 'TIMESTAMP',
              dataTypeDisplay: 'timestamp',
              description:
                'The date (ISO 8601) and time (UTC) when the visitor first starts entering their information into the checkout fields. Contains NULL if the visitor never enters their information during the session. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.started_first_checkout_at',
              tags: [],
              ordinalPosition: 17,
            },
            {
              name: 'count_of_cart_additions',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description:
                'The number of items added to the cart during the session. For example, if a customer adds 5 t-shirts and 1 lipstick to their cart, and then removes one of the t-shirts, then the value in this column is 6.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.count_of_cart_additions',
              tags: [],
              ordinalPosition: 18,
            },
            {
              name: 'count_of_distinct_products_added_to_cart',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description:
                'The number of distinct products added to the cart during the session. For example, if a customer adds 5 t-shirts and 1 lipstick are added to the cart, then the value in this column is 2.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.count_of_distinct_products_added_to_cart',
              tags: [],
              ordinalPosition: 19,
            },
            {
              name: 'count_of_distinct_product_variants_added_to_cart',
              dataType: 'NUMERIC',
              dataTypeDisplay: 'numeric',
              description:
                'The number of distinct product variants added to the cart during the session. For example, if a customer adds 2 small and 3 large t-shirts and 1 lipstick to the cart, then the value in this column is 3.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.count_of_distinct_product_variants_added_to_cart',
              tags: [],
              ordinalPosition: 20,
            },
            {
              name: 'had_error',
              dataType: 'BOOLEAN',
              dataTypeDisplay: 'boolean',
              description:
                'True when an an error appears during the checkout that is not a payment error, False otherwise.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.had_error',
              tags: [],
              ordinalPosition: 21,
            },
            {
              name: 'had_payment_error',
              dataType: 'BOOLEAN',
              dataTypeDisplay: 'boolean',
              description:
                'True when a payment error occurs during the checkout, False otherwise.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.had_payment_error',
              tags: [],
              ordinalPosition: 22,
            },
            {
              name: 'had_out_of_stock_warning',
              dataType: 'BOOLEAN',
              dataTypeDisplay: 'boolean',
              description:
                'True when an out-of-stock warning appears on the checkout page, False otherwise.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.had_out_of_stock_warning',
              tags: [],
              ordinalPosition: 23,
            },
            {
              name: 'had_credit_card_info_error',
              dataType: 'BOOLEAN',
              dataTypeDisplay: 'boolean',
              description:
                'True when a payment error occurs because of a credit card error, False otherwise.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.had_credit_card_info_error',
              tags: [],
              ordinalPosition: 24,
            },
            {
              name: 'had_discount',
              dataType: 'BOOLEAN',
              dataTypeDisplay: 'boolean',
              description:
                'True when a checkout error occurs because of a discount error, False otherwise.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.had_discount',
              tags: [],
              ordinalPosition: 25,
            },
            {
              name: 'had_free_shipping',
              dataType: 'BOOLEAN',
              dataTypeDisplay: 'boolean',
              description:
                'True when the order has no shipping cost, False otherwise.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.had_free_shipping',
              tags: [],
              ordinalPosition: 26,
            },
            {
              name: 'location_city',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description:
                'The name of the city where the visitor is located. For example, Topeka.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.location_city',
              tags: [],
              ordinalPosition: 27,
            },
            {
              name: 'location_region',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description:
                'The name of the region, such as a province or state, where the visitor is located. For example, Kansas.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.location_region',
              tags: [],
              ordinalPosition: 28,
            },
            {
              name: 'location_region_code',
              dataType: 'VARCHAR',
              dataLength: 200,
              dataTypeDisplay: 'varchar',
              description:
                'The code for the region, such as a province or state, where the visitor is located. For example, KS.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.location_region_code',
              tags: [],
              ordinalPosition: 29,
            },
            {
              name: 'location_country',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description:
                'The name of the country where the visitor is located. For example, United States.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.location_country',
              tags: [],
              ordinalPosition: 30,
            },
            {
              name: 'location_country_code',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description:
                'The two-digit ISO country code where the visitor is located. For example, US.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_session.location_country_code',
              tags: [],
              ordinalPosition: 31,
            },
          ],
          databaseSchema: {
            id: 'be37a61e-fb10-4748-86ab-0714613a42ea',
            type: 'databaseSchema',
            name: 'shopify',
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
            description:
              'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
            deleted: false,
            href: 'http://openmetadata-server:8585/api/v1/databaseSchemas/be37a61e-fb10-4748-86ab-0714613a42ea',
          },
          database: {
            id: '0dac7caf-8419-4a0b-a96e-345730b2c0f5',
            type: 'database',
            name: 'ecommerce_db',
            fullyQualifiedName: 'sample_data.ecommerce_db',
            description:
              'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
            deleted: false,
            href: 'http://openmetadata-server:8585/api/v1/databases/0dac7caf-8419-4a0b-a96e-345730b2c0f5',
          },
          service: {
            id: 'f24cd129-f864-45d9-8cce-46a9aecd6846',
            type: 'databaseService',
            name: 'sample_data',
            fullyQualifiedName: 'sample_data',
            deleted: false,
            href: 'http://openmetadata-server:8585/api/v1/services/databaseServices/f24cd129-f864-45d9-8cce-46a9aecd6846',
          },
          serviceType: 'BigQuery',
          tags: [],
          deleted: false,
          displayName: 'fact_session',
          tier: null,
          followers: [],
          suggest: [],
          service_suggest: [{ input: 'sample_data', weight: 5 }],
          column_suggest: [
            { input: 'derived_session_token', weight: 5 },
            { input: 'shop_id', weight: 5 },
            { input: 'session_duration', weight: 5 },
            { input: 'count_of_pageviews', weight: 5 },
            { input: 'session_started_at', weight: 5 },
            { input: 'session_token', weight: 5 },
            { input: 'user_token', weight: 5 },
            { input: 'landing_page_url', weight: 5 },
            { input: 'exit_page_path', weight: 5 },
            { input: 'exit_page_url', weight: 5 },
            { input: 'referrer_tld', weight: 5 },
            { input: 'ua_browser', weight: 5 },
            { input: 'ua_raw', weight: 5 },
            { input: 'count_of_orders_completed', weight: 5 },
            { input: 'completed_first_order_at', weight: 5 },
            { input: 'hit_first_checkout_at', weight: 5 },
            { input: 'started_first_checkout_at', weight: 5 },
            { input: 'count_of_cart_additions', weight: 5 },
            { input: 'count_of_distinct_products_added_to_cart', weight: 5 },
            {
              input: 'count_of_distinct_product_variants_added_to_cart',
              weight: 5,
            },
            { input: 'had_error', weight: 5 },
            { input: 'had_payment_error', weight: 5 },
            { input: 'had_out_of_stock_warning', weight: 5 },
            { input: 'had_credit_card_info_error', weight: 5 },
            { input: 'had_discount', weight: 5 },
            { input: 'had_free_shipping', weight: 5 },
            { input: 'location_city', weight: 5 },
            { input: 'location_region', weight: 5 },
            { input: 'location_region_code', weight: 5 },
            { input: 'location_country', weight: 5 },
            { input: 'location_country_code', weight: 5 },
          ],
          schema_suggest: [{ input: 'shopify', weight: 5 }],
          database_suggest: [{ input: 'ecommerce_db', weight: 5 }],
          entityType: 'table',
        },
        highlight: {
          'columns.description': [
            'This column is a foreign key reference to the shop_id column in the <span class="text-highlighter">dim</span>_shop table.',
            'For example, if a customer <span class="text-highlighter">adds</span> 5 t-shirts and 1 lipstick to their cart, and then removes one of the',
            'For example, if a customer <span class="text-highlighter">adds</span> 5 t-shirts and 1 lipstick are added to the cart, then the value in this',
            'For example, if a customer <span class="text-highlighter">adds</span> 2 small and 3 large t-shirts and 1 lipstick to the cart, then the value',
          ],
        },
      },
    ],
  },
  aggregations: {
    'sterms#serviceType': {
      doc_count_error_upper_bound: 0,
      sum_other_doc_count: 0,
      buckets: [{ key: 'BigQuery', doc_count: 4 }],
    },
    'sterms#databaseSchema.name.keyword': {
      doc_count_error_upper_bound: 0,
      sum_other_doc_count: 0,
      buckets: [{ key: 'shopify', doc_count: 4 }],
    },
    'sterms#tags.tagFQN': {
      doc_count_error_upper_bound: 0,
      sum_other_doc_count: 0,
      buckets: [],
    },
    'sterms#entityType': {
      doc_count_error_upper_bound: 0,
      sum_other_doc_count: 0,
      buckets: [{ key: 'table', doc_count: 4 }],
    },
    'sterms#tier.tagFQN': {
      doc_count_error_upper_bound: 0,
      sum_other_doc_count: 0,
      buckets: [],
    },
    'sterms#service.name.keyword': {
      doc_count_error_upper_bound: 0,
      sum_other_doc_count: 0,
      buckets: [{ key: 'sample_data', doc_count: 4 }],
    },
    'sterms#database.name.keyword': {
      doc_count_error_upper_bound: 0,
      sum_other_doc_count: 0,
      buckets: [{ key: 'ecommerce_db', doc_count: 4 }],
    },
  },
};

export const MOCK_EXPLORE_PAGE_COUNT = {
  [SearchIndex.DATA_PRODUCT]: 0,
  [SearchIndex.TABLE]: mockSearchData.hits.total.value,
  [SearchIndex.TOPIC]: 0,
  [SearchIndex.DASHBOARD]: 0,
  [SearchIndex.DATABASE]: 0,
  [SearchIndex.DATABASE_SCHEMA]: 0,
  [SearchIndex.PIPELINE]: 0,
  [SearchIndex.MLMODEL]: 0,
  [SearchIndex.CONTAINER]: 0,
  [SearchIndex.STORED_PROCEDURE]: 0,
  [SearchIndex.DASHBOARD_DATA_MODEL]: 0,
  [SearchIndex.GLOSSARY_TERM]: 0,
  [SearchIndex.TAG]: 0,
  [SearchIndex.SEARCH_INDEX]: 0,
};
