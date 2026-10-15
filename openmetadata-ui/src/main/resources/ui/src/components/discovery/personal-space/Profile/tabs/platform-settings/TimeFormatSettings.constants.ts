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
import { DefaultTimeFormat } from '../../../../../../generated/api/configuration/appConfiguration';

export const TIME_FORMAT_OPTIONS = [
  { value: DefaultTimeFormat.The12H, labelKey: 'label.12-hour-format' },
  { value: DefaultTimeFormat.The24H, labelKey: 'label.24-hour-format' },
];
