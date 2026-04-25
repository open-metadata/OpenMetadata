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

import { ServiceNestedConnectionFields } from '../enums/service.enum';
import { SERVICE_FILTER_PATTERN_FIELDS } from './ServiceConnection.constants';

export const DEF_UI_SCHEMA = {
  supportsIncrementalMetadataExtraction: {
    'ui:widget': 'hidden',
    'ui:hideError': true,
  },
  supportsMetadataExtraction: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsSystemProfile: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsDataDiff: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsUsageExtraction: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsLineageExtraction: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsViewLineageExtraction: {
    'ui:widget': 'hidden',
    'ui:hideError': true,
  },
  supportsProfiler: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsDatabase: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsQueryComment: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsDBTExtraction: { 'ui:widget': 'hidden', 'ui:hideError': true },
  type: { 'ui:widget': 'hidden' },
};

export const INGESTION_ELASTIC_SEARCH_WORKFLOW_UI_SCHEMA = {
  useSSL: { 'ui:widget': 'hidden', 'ui:hideError': true },
  verifyCerts: { 'ui:widget': 'hidden', 'ui:hideError': true },
  timeout: { 'ui:widget': 'hidden', 'ui:hideError': true },
  caCerts: { 'ui:widget': 'hidden', 'ui:hideError': true },
  useAwsCredentials: { 'ui:widget': 'hidden', 'ui:hideError': true },
  regionName: { 'ui:widget': 'hidden', 'ui:hideError': true },
};

export const INGESTION_WORKFLOW_UI_SCHEMA = {
  type: { 'ui:widget': 'hidden', 'ui:hideError': true },
  name: { 'ui:widget': 'hidden', 'ui:hideError': true },
  processingEngine: { 'ui:widget': 'hidden', 'ui:hideError': true },
  defaultManifest: { 'ui:widget': 'manifestJson' },
  'ui:order': [
    'rootProcessingEngine',
    'name',
    'displayName',
    ...SERVICE_FILTER_PATTERN_FIELDS,
    'enableDebugLog',
    '*',
  ],
};

export const EXCLUDE_INCREMENTAL_EXTRACTION_SUPPORT_UI_SCHEMA = {
  incremental: {
    'ui:widget': 'hidden',
    'ui:hideError': true,
  },
};

export const COMMON_UI_SCHEMA = {
  ...DEF_UI_SCHEMA,
  [ServiceNestedConnectionFields.CONNECTION]: {
    ...DEF_UI_SCHEMA,
  },
  [ServiceNestedConnectionFields.METASTORE_CONNECTION]: {
    ...DEF_UI_SCHEMA,
  },
  [ServiceNestedConnectionFields.DATABASE_CONNECTION]: {
    ...DEF_UI_SCHEMA,
  },
};
