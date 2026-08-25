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

import { PageData } from 'analytics';

export interface PayloadProperties {
  title: string;
  url: string;
  path: string;
  hash: string;
  search: string;
  width: number;
  height: number;
  referrer: string;
}

export interface Payload {
  type: string;
  properties: PayloadProperties;
  anonymousId: string;
  event: string;
  meta: {
    rid: string;
    ts: number;
    hasCallback: boolean;
  };
}

export interface AnalyticsData extends PageData {
  payload: Payload;
}
