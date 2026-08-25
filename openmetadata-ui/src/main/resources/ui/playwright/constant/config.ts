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

export const PLAYWRIGHT_INGESTION_TAG_OBJ = {
  tag: '@ingestion',
};

export const PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ = {
  tag: '@sample-data',
};

// Aim to support tests which are independent of metadata / ingestion framework to run with DataAssetRules tests
export const PLAYWRIGHT_BASIC_TEST_TAG_OBJ = {
  tag: '@basic',
};

export const DOMAIN_TAGS = {
  GOVERNANCE: '@Governance',
  DISCOVERY: '@Discovery',
  PLATFORM: '@Platform',
  OBSERVABILITY: '@Observability',
  INTEGRATION: '@Integration',
};
