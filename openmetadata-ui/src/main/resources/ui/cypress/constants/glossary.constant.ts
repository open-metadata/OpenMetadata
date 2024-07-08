/*
 *  Copyright 2024 Collate.
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

import { uuid } from './constants';

export const GLOSSARY_OWNER_LINK_TEST_ID = 'glossary-right-panel-owner-link';

export const GLOSSARY_DETAILS1 = {
  name: `Cypress%QFTEST ${uuid()}`,
  displayName: `Cypress % QFTEST ${uuid()}`,
  description: 'Test Glossary',
  reviewers: [],
  tags: [],
  mutuallyExclusive: false,
};

export const GLOSSARY_TERM_DETAILS1 = {
  name: `CypressQFTEST_TERM-${uuid()}`,
  displayName: 'Cypress QFTEST_TERM',
  description: 'Quick filter test.',
  reviewers: [],
  relatedTerms: [],
  synonyms: [],
  mutuallyExclusive: false,
  tags: [],
  style: {},
  glossary: GLOSSARY_DETAILS1.name,
};

const COMMON_ASSETS = [
  {
    name: 'dim_customer',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_customer',
  },
  {
    name: 'raw_order',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_order',
  },
  {
    name: 'presto_etl',
    fullyQualifiedName: 'sample_airflow.presto_etl',
  },
];

const cypressGlossaryName = `Cypress Glossary ${uuid()}`;

// Glossary with Multiple Users as Reviewers
export const GLOSSARY_1 = {
  name: cypressGlossaryName,
  description: 'This is the Cypress Glossary',
  reviewers: [
    { name: 'Amber Green', type: 'user' },
    { name: 'Andrea Reed', type: 'user' },
  ],
  tag: 'PersonalData.Personal',
  isMutually: true,
  owner: 'admin',
  updatedOwner: 'Aaron Warren',
  terms: [
    {
      name: 'CypressPurchase',
      description: 'This is the Cypress Purchase',
      synonyms: 'buy,collect,acquire',
      fullyQualifiedName: `${cypressGlossaryName}.CypressPurchase`,
      owner: 'Aaron Johnson',
      reviewers: [],
    },
    {
      name: 'CypressSales',
      description: 'This is the Cypress Sales',
      synonyms: 'give,disposal,deal',
      fullyQualifiedName: `${cypressGlossaryName}.CypressSales`,
      owner: 'Aaron Johnson',
      reviewers: [],
    },
    {
      name: 'Cypress Space',
      description: 'This is the Cypress with space',
      synonyms: 'tea,coffee,water',
      fullyQualifiedName: `${cypressGlossaryName}.Cypress Space`,
      assets: COMMON_ASSETS,
      owner: 'admin',
      reviewers: [],
    },
  ],
};

const cypressProductGlossaryName = `Cypress Product%Glossary ${uuid()}`;

// Glossary with Team as Reviewers
export const GLOSSARY_2 = {
  name: cypressProductGlossaryName,
  description: 'This is the Product glossary with percentage',
  reviewers: [{ name: 'Applications', type: 'team' }],
  owner: 'admin',
  terms: [
    {
      name: 'Features%Term',
      description: 'This is the Features',
      synonyms: 'data,collect,time',
      fullyQualifiedName: `${cypressProductGlossaryName}.Features%Term`,
      color: '#FF5733',
      icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF8AAACFCAMAAAAKN9SOAAAAA1BMVEXmGSCqexgYAAAAI0lEQVRoge3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAHgaMeAAAUWJHZ4AAAAASUVORK5CYII=',
    },
    {
      name: 'Uses',
      description: 'This is the Uses',
      synonyms: 'home,business,adventure',
      fullyQualifiedName: `${cypressProductGlossaryName}.Uses`,
      color: '#50C878',
      icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKEAAAB5CAMAAABm4rHGAAAAA1BMVEUA7gBnh+O4AAAAKUlEQVR4nO3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAAAAAAAAAAAL8GTJIAAVDbVToAAAAASUVORK5CYII=',
    },
  ],
};

const cypressAssetsGlossaryName = `Cypress Assets Glossary ${uuid()}`;
const assetTermsUUId = uuid();

// Glossary with No Reviewer
export const GLOSSARY_3 = {
  name: cypressAssetsGlossaryName,
  description: 'This is the Product glossary with percentage',
  reviewers: [],
  owner: 'admin',
  newDescription: 'This is the new Product glossary with percentage.',
  terms: [
    {
      name: `Term1_${assetTermsUUId}`,
      description: 'term1 desc',
      fullyQualifiedName: `${cypressAssetsGlossaryName}.Term1_${assetTermsUUId}`,
      synonyms: 'buy,collect,acquire',
      assets: COMMON_ASSETS,
    },
    {
      name: `Term2_${assetTermsUUId}`,
      description: 'term2 desc',
      synonyms: 'give,disposal,deal',
      fullyQualifiedName: `${cypressAssetsGlossaryName}.Term2_${assetTermsUUId}`,
      assets: COMMON_ASSETS,
    },
    {
      name: `Term3_${assetTermsUUId}`,
      synonyms: 'tea,coffee,water',
      description: 'term3 desc',
      fullyQualifiedName: `${cypressAssetsGlossaryName}.Term3_${assetTermsUUId}`,
      assets: COMMON_ASSETS,
    },
  ],
};
