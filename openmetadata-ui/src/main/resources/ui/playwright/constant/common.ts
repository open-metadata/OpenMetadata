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
export const TAG_INVALID_NAMES = {
  MIN_LENGTH: 'c',
  MAX_LENGTH: 'a87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890ab',
  WITH_SPECIAL_CHARS: '!@#$%^&*()',
};

export const INVALID_NAMES = {
  MAX_LENGTH:
    'a87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890aba87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890abName can be a maximum of 128 characters',
  WITH_SPECIAL_CHARS: '::normalName::',
};

export const NAME_VALIDATION_ERROR =
  'Name must contain only letters, numbers, underscores, hyphens, periods, parenthesis, and ampersands.';

export const NAME_MIN_MAX_LENGTH_VALIDATION_ERROR =
  'Name size must be between 2 and 64';

export const NAME_MAX_LENGTH_VALIDATION_ERROR =
  'Name size must be between 1 and 128';

export const DELETE_TERM = 'DELETE';

export const COMMON_TIER_TAG = [
  {
    id: 'd9b52629-0288-4d29-99bf-ecdd1713d285',
    name: 'Tier1',
    fullyQualifiedName: 'Tier.Tier1',
    description:
      '**Critical Source of Truth business data assets of an organization**\n\n' +
      '- Used in critical metrics and dashboards to drive business and product decisions\n\n' +
      '- Used in critical compliance reporting to regulators, govt entities, and third party\n\n' +
      '- Used in brand or revenue impacting online user-facing experiences (search results, advertisement, promotions, and experimentation)\n\n' +
      '- Other high impact use, such as ML models and fraud detection\n\n' +
      '- Source used to derive other critical Tier-1 datasets',
    style: {
      color: '#ec1313',
    },
    version: 0.2,
    updatedAt: 1718953086669,
    updatedBy: 'dovile.kr',
    href: 'https://sandbox-beta.open-metadata.org/v1/tags/d9b52629-0288-4d29-99bf-ecdd1713d285',
    usageCount: 0,
    deprecated: false,
    deleted: false,
    changeDescription: {
      fieldsAdded: [
        {
          name: 'style',
          newValue: '{"color":"#ec1313"}',
        },
      ],
      fieldsUpdated: [],
      fieldsDeleted: [],
      previousVersion: 0.1,
    },
    provider: 'system',
    disabled: false,
    mutuallyExclusive: false,
  },
  {
    id: 'fafc6234-f036-4e02-9666-20e30ceb593b',
    name: 'Tier2',
    fullyQualifiedName: 'Tier.Tier2',
    description:
      '**Important business datasets for your company (not as critical as Tier 1)**\n\n' +
      '- Used in important business metrics, product metrics, and dashboards to drive internal decisions\n\n' +
      '- Used in important compliance reporting to major regulators, govt entities, and third party\n\n' +
      '- Used for less critical online user-facing experiences (user activity, user behavior)\n\n' +
      '- Source used to derive other critical Tier-2 datasets',
    version: 0.1,
    updatedAt: 1697263885126,
    updatedBy: 'admin',
    href: 'https://sandbox-beta.open-metadata.org/v1/tags/fafc6234-f036-4e02-9666-20e30ceb593b',
    usageCount: 0,
    deprecated: false,
    deleted: false,
    provider: 'system',
    disabled: false,
    mutuallyExclusive: false,
  },
  {
    id: 'de9dba4b-a92c-4a58-a3d8-93e72f315a29',
    name: 'Tier3',
    fullyQualifiedName: 'Tier.Tier3',
    description:
      '**Department/group level datasets that are typically non-business and general internal system**\n\n' +
      '- Used in product metrics, and dashboards to drive product decisions\n\n' +
      '- Used to track operational metrics of internal systems\n\n' +
      '- Source used to derive other critical Tier-3 datasets',
    version: 0.1,
    updatedAt: 1697263885149,
    updatedBy: 'admin',
    href: 'https://sandbox-beta.open-metadata.org/v1/tags/de9dba4b-a92c-4a58-a3d8-93e72f315a29',
    usageCount: 0,
    deprecated: false,
    deleted: false,
    provider: 'system',
    disabled: false,
    mutuallyExclusive: false,
  },
  {
    id: '9ee864ea-d8e6-4ecc-9017-57d1e72e501e',
    name: 'Tier4',
    fullyQualifiedName: 'Tier.Tier4',
    description:
      '**Team level datasets that are typically non-business and general internal system**\n\n' +
      '- Used in product metrics, and dashboards to drive team decisions\n\n' +
      '- Used to track operational metrics of internal systems owned by the team\n\n' +
      '- Source used to derive other critical Tier-4 datasets',
    version: 0.1,
    updatedAt: 1697263885174,
    updatedBy: 'admin',
    href: 'https://sandbox-beta.open-metadata.org/v1/tags/9ee864ea-d8e6-4ecc-9017-57d1e72e501e',
    usageCount: 0,
    deprecated: false,
    deleted: false,
    provider: 'system',
    disabled: false,
    mutuallyExclusive: false,
  },
  {
    id: '36c08b3b-85b5-460b-86b7-806857314883',
    name: 'Tier5',
    fullyQualifiedName: 'Tier.Tier5',
    description:
      '**Private/Unused data assets - No impact beyond individual users**\n\n' +
      '- Data assets without any ownership with no usage in the last 60 days\n\n' +
      '- Data assets owned by individuals without team ownership\n\n',
    version: 0.1,
    updatedAt: 1697263885196,
    updatedBy: 'admin',
    href: 'https://sandbox-beta.open-metadata.org/v1/tags/36c08b3b-85b5-460b-86b7-806857314883',
    usageCount: 0,
    deprecated: false,
    deleted: false,
    provider: 'system',
    disabled: false,
    mutuallyExclusive: false,
  },
];
