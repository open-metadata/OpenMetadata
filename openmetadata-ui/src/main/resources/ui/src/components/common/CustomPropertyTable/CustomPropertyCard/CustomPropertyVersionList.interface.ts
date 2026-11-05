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
import { CustomProperty } from '../../../../generated/type/customProperty';

export interface CustomPropertyVersionListProps {
  properties: CustomProperty[];
  /** Extension of the version; a changed value holds its word-diff markup. */
  extension?: Record<string, unknown>;
  /** Properties that first got a value in this version. */
  addedKeys?: string[];
}
