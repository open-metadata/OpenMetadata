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
import { EntityType } from '../../enums/entity.enum';

export const MOCK_APPLICATION_ENTITY_STATS = {
  [EntityType.TAG]: {
    totalRecords: 10,
    failedRecords: 0,
    successRecords: 10,
  },
  [EntityType.TEAM]: {
    totalRecords: 17,
    failedRecords: 0,
    successRecords: 17,
  },
  [EntityType.USER]: {
    totalRecords: 105,
    failedRecords: 0,
    successRecords: 105,
  },
  [EntityType.CHART]: {
    totalRecords: 16,
    failedRecords: 0,
    successRecords: 16,
  },
  [EntityType.QUERY]: {
    totalRecords: 8,
    failedRecords: 0,
    successRecords: 8,
  },
  [EntityType.TABLE]: {
    totalRecords: 180,
    failedRecords: 0,
    successRecords: 180,
  },
  [EntityType.TOPIC]: {
    totalRecords: 10,
    failedRecords: 0,
    successRecords: 10,
  },
  [EntityType.DOMAIN]: {
    totalRecords: 0,
    failedRecords: 0,
    successRecords: 0,
  },
  [EntityType.MLMODEL]: {
    totalRecords: 2,
    failedRecords: 0,
    successRecords: 2,
  },
  [EntityType.DATABASE]: {
    totalRecords: 2,
    failedRecords: 0,
    successRecords: 2,
  },
  [EntityType.GLOSSARY]: {
    totalRecords: 1,
    failedRecords: 0,
    successRecords: 1,
  },
  [EntityType.PIPELINE]: {
    totalRecords: 8,
    failedRecords: 0,
    successRecords: 8,
  },
  [EntityType.TEST_CASE]: {
    totalRecords: 7,
    failedRecords: 0,
    successRecords: 7,
  },
  [EntityType.CONTAINER]: {
    totalRecords: 17,
    failedRecords: 0,
    successRecords: 17,
  },
  [EntityType.DASHBOARD]: {
    totalRecords: 14,
    failedRecords: 0,
    successRecords: 14,
  },
  [EntityType.TEST_SUITE]: {
    totalRecords: 3,
    failedRecords: 0,
    successRecords: 3,
  },
  [EntityType.DATA_PRODUCT]: {
    totalRecords: 0,
    failedRecords: 0,
    successRecords: 0,
  },
  [EntityType.SEARCH_INDEX]: {
    totalRecords: 1,
    failedRecords: 0,
    successRecords: 1,
  },
  [EntityType.GLOSSARY_TERM]: {
    totalRecords: 0,
    failedRecords: 0,
    successRecords: 0,
  },
  [EntityType.SEARCH_SERVICE]: {
    totalRecords: 1,
    failedRecords: 0,
    successRecords: 1,
  },
  [EntityType.CLASSIFICATION]: {
    totalRecords: 3,
    failedRecords: 0,
    successRecords: 3,
  },
  [EntityType.DATABASE_SCHEMA]: {
    totalRecords: 4,
    failedRecords: 0,
    successRecords: 4,
  },
  [EntityType.MLMODEL_SERVICE]: {
    totalRecords: 1,
    failedRecords: 0,
    successRecords: 1,
  },
  [EntityType.STORAGE_SERVICE]: {
    totalRecords: 1,
    failedRecords: 0,
    successRecords: 1,
  },
  [EntityType.DATABASE_SERVICE]: {
    totalRecords: 3,
    failedRecords: 0,
    successRecords: 3,
  },
  [EntityType.METADATA_SERVICE]: {
    totalRecords: 1,
    failedRecords: 0,
    successRecords: 1,
  },
  [EntityType.PIPELINE_SERVICE]: {
    totalRecords: 1,
    failedRecords: 0,
    successRecords: 1,
  },
  [EntityType.STORED_PROCEDURE]: {
    totalRecords: 12,
    failedRecords: 0,
    successRecords: 12,
  },
  [EntityType.DASHBOARD_SERVICE]: {
    totalRecords: 2,
    failedRecords: 0,
    successRecords: 2,
  },
  [EntityType.ENTITY_REPORT_DATA]: {
    totalRecords: 4,
    failedRecords: 0,
    successRecords: 4,
  },
  [EntityType.MESSAGING_SERVICE]: {
    totalRecords: 1,
    failedRecords: 0,
    successRecords: 1,
  },
  [EntityType.INGESTION_PIPELINE]: {
    totalRecords: 4,
    failedRecords: 0,
    successRecords: 4,
  },
  [EntityType.DASHBOARD_DATA_MODEL]: {
    totalRecords: 6,
    failedRecords: 0,
    successRecords: 6,
  },
  [EntityType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA]: {
    totalRecords: 2,
    failedRecords: 0,
    successRecords: 2,
  },
  [EntityType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA]: {
    totalRecords: 4,
    failedRecords: 0,
    successRecords: 4,
  },
  [EntityType.TEST_CASE_RESOLUTION_STATUS]: {
    totalRecords: 4,
    failedRecords: 0,
    successRecords: 4,
  },
  [EntityType.TEST_CASE_RESULT]: {
    totalRecords: 4,
    failedRecords: 0,
    successRecords: 4,
  },
  totalRecords: 0,
  successRecords: 0,
  failedRecords: 0,
};

export const MOCK_APPLICATION_ENTITY_STATS_DATA = [
  {
    name: EntityType.TAG,
    totalRecords: 10,
    successRecords: 10,
    failedRecords: 0,
  },
  {
    name: EntityType.TEAM,
    totalRecords: 17,
    successRecords: 17,
    failedRecords: 0,
  },
  {
    name: EntityType.USER,
    totalRecords: 105,
    successRecords: 105,
    failedRecords: 0,
  },
  {
    name: EntityType.CHART,
    totalRecords: 16,
    successRecords: 16,
    failedRecords: 0,
  },
  {
    name: EntityType.QUERY,
    totalRecords: 8,
    successRecords: 8,
    failedRecords: 0,
  },
  {
    name: EntityType.TABLE,
    totalRecords: 180,
    successRecords: 180,
    failedRecords: 0,
  },
  {
    name: EntityType.TOPIC,
    totalRecords: 10,
    successRecords: 10,
    failedRecords: 0,
  },
  {
    name: EntityType.DOMAIN,
    totalRecords: 0,
    successRecords: 0,
    failedRecords: 0,
  },
  {
    name: EntityType.MLMODEL,
    totalRecords: 2,
    successRecords: 2,
    failedRecords: 0,
  },
  {
    name: EntityType.DATABASE,
    totalRecords: 2,
    successRecords: 2,
    failedRecords: 0,
  },
  {
    name: EntityType.GLOSSARY,
    totalRecords: 1,
    successRecords: 1,
    failedRecords: 0,
  },
  {
    name: EntityType.PIPELINE,
    totalRecords: 8,
    successRecords: 8,
    failedRecords: 0,
  },
  {
    name: EntityType.TEST_CASE,
    totalRecords: 7,
    failedRecords: 0,
    successRecords: 7,
  },
  {
    name: EntityType.CONTAINER,
    totalRecords: 17,
    failedRecords: 0,
    successRecords: 17,
  },
  {
    name: EntityType.DASHBOARD,
    totalRecords: 14,
    failedRecords: 0,
    successRecords: 14,
  },
  {
    name: EntityType.TEST_SUITE,
    totalRecords: 3,
    failedRecords: 0,
    successRecords: 3,
  },
  {
    name: EntityType.DATA_PRODUCT,
    totalRecords: 0,
    successRecords: 0,
    failedRecords: 0,
  },
  {
    name: EntityType.SEARCH_INDEX,
    totalRecords: 1,
    failedRecords: 0,
    successRecords: 1,
  },
  {
    name: EntityType.GLOSSARY_TERM,
    totalRecords: 0,
    successRecords: 0,
    failedRecords: 0,
  },
  {
    name: EntityType.SEARCH_SERVICE,
    totalRecords: 1,
    failedRecords: 0,
    successRecords: 1,
  },
  {
    name: EntityType.CLASSIFICATION,
    totalRecords: 3,
    failedRecords: 0,
    successRecords: 3,
  },
  {
    name: EntityType.DATABASE_SCHEMA,
    totalRecords: 4,
    failedRecords: 0,
    successRecords: 4,
  },
  {
    name: EntityType.MLMODEL_SERVICE,
    totalRecords: 1,
    failedRecords: 0,
    successRecords: 1,
  },
  {
    name: EntityType.STORAGE_SERVICE,
    totalRecords: 1,
    failedRecords: 0,
    successRecords: 1,
  },
  {
    name: EntityType.DATABASE_SERVICE,
    totalRecords: 3,
    failedRecords: 0,
    successRecords: 3,
  },
  {
    name: EntityType.METADATA_SERVICE,
    totalRecords: 1,
    failedRecords: 0,
    successRecords: 1,
  },
  {
    name: EntityType.PIPELINE_SERVICE,
    totalRecords: 1,
    failedRecords: 0,
    successRecords: 1,
  },
  {
    name: EntityType.STORED_PROCEDURE,
    totalRecords: 12,
    failedRecords: 0,
    successRecords: 12,
  },
  {
    name: EntityType.DASHBOARD_SERVICE,
    totalRecords: 2,
    failedRecords: 0,
    successRecords: 2,
  },
  {
    name: EntityType.ENTITY_REPORT_DATA,
    totalRecords: 4,
    failedRecords: 0,
    successRecords: 4,
  },
  {
    name: EntityType.MESSAGING_SERVICE,
    totalRecords: 1,
    failedRecords: 0,
    successRecords: 1,
  },
  {
    name: EntityType.INGESTION_PIPELINE,
    totalRecords: 4,
    failedRecords: 0,
    successRecords: 4,
  },
  {
    name: EntityType.DASHBOARD_DATA_MODEL,
    totalRecords: 6,
    failedRecords: 0,
    successRecords: 6,
  },
  {
    name: EntityType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA,
    totalRecords: 2,
    failedRecords: 0,
    successRecords: 2,
  },
  {
    name: EntityType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA,
    totalRecords: 4,
    failedRecords: 0,
    successRecords: 4,
  },
  {
    name: EntityType.TEST_CASE_RESOLUTION_STATUS,
    totalRecords: 4,
    failedRecords: 0,
    successRecords: 4,
  },
  {
    name: EntityType.TEST_CASE_RESULT,
    totalRecords: 4,
    failedRecords: 0,
    successRecords: 4,
  },
];
