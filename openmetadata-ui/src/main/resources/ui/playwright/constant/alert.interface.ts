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

export interface FilterDetails {
  name: string;
  effect: string;
  arguments: Array<{
    name: string;
    input: Array<string>;
  }>;
}

export interface AlertDetails {
  name: string;
  displayName: string;
  id: string;
  description: string;
  filteringRules: { resources: Array<string> };
  input: {
    filters: Array<FilterDetails>;
    actions: Array<FilterDetails>;
  };
  destinations: Array<{
    category: string;
    type: string;
    timeout: string;
    readTimeout: string;
    config: {
      secretKey: string;
      receivers: Array<string>;
    };
  }>;
}

export interface ObservabilityCreationDetails {
  source: string;
  sourceDisplayName: string;
  filters: Array<{
    name: string;
    inputSelector: string;
    inputValue: string;
    inputValueId?: string;
    exclude?: boolean;
  }>;
  actions: Array<{
    name: string;
    exclude?: boolean;
    inputs?: Array<{
      inputSelector: string;
      inputValue: string;
      waitForAPI?: boolean;
    }>;
  }>;
  destinations: Array<{
    mode: string;
    category: string;
    type?: string;
    inputValue?: string;
    inputSelector?: string;
    secretKey?: string;
  }>;
}

export interface EventDetails {
  status: 'successful' | 'failed';
  data: {
    id: string;
    entityType: string;
    eventType: string;
    entityId: string;
  }[];
}
