/*
 *  Copyright 2023 Collate.
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

import { EntityFields } from '../enums/AdvancedSearch.enum';
import { Domain, DomainType } from '../generated/entity/domains/domain';

export const DOMAIN_TYPE_DATA = [
  {
    type: 'label.aggregate',
    description: 'message.aggregate-domain-type-description',
  },
  {
    type: 'label.consumer-aligned',
    description: 'message.consumer-aligned-domain-type-description',
  },
  {
    type: 'label.source-aligned',
    description: 'message.source-aligned-domain-type-description',
  },
];

export const DOMAIN_DUMMY_DATA: Domain = {
  id: '31c2b84e-b87a-4e47-934f-9c5309fbb7c3',
  domainType: DomainType.ConsumerAligned,
  name: 'Engineering',
  fullyQualifiedName: 'Engineering',
  displayName: 'Engineering',
  description: 'Domain related engineering development.',
  style: {},
  version: 0.8,
  updatedAt: 1698061758989,
  updatedBy: 'rupesh',
  children: [],
  owners: [
    {
      id: 'ebac156e-6779-499c-8bbf-ab98a6562bc5',
      type: 'team',
      name: 'Data',
      fullyQualifiedName: 'Data',
      description: '',
      displayName: 'Data',
      deleted: false,
    },
  ],
  experts: [
    {
      id: '34ee72dc-7dad-4710-9f1d-e934ad0554a9',
      type: 'user',
      name: 'brian_smith7',
      fullyQualifiedName: 'brian_smith7',
      displayName: 'Brian Smith',
      deleted: false,
    },
    {
      id: '9a6687fa-8bd5-446c-aa8f-81416c88fe67',
      type: 'user',
      name: 'brittney_thomas3',
      fullyQualifiedName: 'brittney_thomas3',
      displayName: 'Brittney Thomas',
      deleted: false,
      href: 'http://sandbox-beta.open-metadata.org/api/v1/users/9a6687fa-8bd5-446c-aa8f-81416c88fe67',
    },
  ],
};

export const DOMAIN_DEFAULT_QUICK_FILTERS = [
  EntityFields.OWNERS,
  EntityFields.CLASSIFICATION_TAGS,
  EntityFields.GLOSSARY_TERMS,
  EntityFields.DOMAIN_TYPE,
];

export const SUBDOMAIN_DEFAULT_QUICK_FILTERS = [
  EntityFields.OWNERS,
  EntityFields.CLASSIFICATION_TAGS,
  EntityFields.GLOSSARY_TERMS,
  EntityFields.DOMAIN_TYPE,
];

export const DOMAIN_FILTERS = [
  {
    label: 'label.owner-plural',
    key: EntityFields.OWNERS,
  },
  {
    label: 'label.tag-plural',
    key: EntityFields.CLASSIFICATION_TAGS,
  },
  {
    label: 'label.glossary-term-plural',
    key: EntityFields.GLOSSARY_TERMS,
  },
  {
    label: 'label.domain-type',
    key: EntityFields.DOMAIN_TYPE,
  },
];

export const SUB_DOMAIN_FILTERS = [
  {
    label: 'label.owner-plural',
    key: EntityFields.OWNERS,
  },
  {
    label: 'label.tag-plural',
    key: EntityFields.CLASSIFICATION_TAGS,
  },
  {
    label: 'label.glossary-term-plural',
    key: EntityFields.GLOSSARY_TERMS,
  },
  {
    label: 'label.domain-type',
    key: EntityFields.DOMAIN_TYPE,
  },
];
