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

export const TAGS_ADD_REMOVE_ENTITIES = [
  {
    term: 'sales',
    displayName: 'sales',
    entity: 'tables',
    serviceName: 'sample_data',
    fieldName: 'SKU',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
  },
  {
    term: 'address_book',
    displayName: 'address_book',
    entity: 'topics',
    serviceName: 'sample_kafka',
    fieldName: 'AddressBook',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
  },
  {
    term: 'deck.gl Demo',
    displayName: 'deck.gl Demo',
    entity: 'charts',
    serviceName: 'sample_superset',
    fieldName: 'e3cfd274-44f8-4bf3-b75d-d40cf88869ba',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
  },
  {
    term: 'dim_address_etl',
    displayName: 'dim_address etl',
    entity: 'pipelines',
    serviceName: 'sample_airflow',
    fieldName: 'dim_address_task',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
  },
];
