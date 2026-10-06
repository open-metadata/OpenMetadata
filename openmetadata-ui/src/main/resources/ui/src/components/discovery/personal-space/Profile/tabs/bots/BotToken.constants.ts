/*
 *  Copyright 2026 Collate.
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

import { JWTTokenExpiry } from '../../../../../../generated/entity/teams/user';

export const TOKEN_EXPIRY_OPTIONS: {
  id: JWTTokenExpiry;
  labelKey: string;
  labelParams?: Record<string, number>;
}[] = [
  { id: JWTTokenExpiry.OneHour, labelKey: 'label.1-hr' },
  { id: JWTTokenExpiry.The1, labelKey: 'label.1-day' },
  {
    id: JWTTokenExpiry.The7,
    labelKey: 'label.number-day-plural',
    labelParams: { number: 7 },
  },
  {
    id: JWTTokenExpiry.The30,
    labelKey: 'label.number-day-plural',
    labelParams: { number: 30 },
  },
  {
    id: JWTTokenExpiry.The60,
    labelKey: 'label.number-day-plural',
    labelParams: { number: 60 },
  },
  {
    id: JWTTokenExpiry.The90,
    labelKey: 'label.number-day-plural',
    labelParams: { number: 90 },
  },
  { id: JWTTokenExpiry.Unlimited, labelKey: 'label.unlimited' },
];
