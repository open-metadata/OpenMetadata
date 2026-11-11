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
import { INITIAL_NODE_ITEMS_LENGTH } from '../../../../constants/Lineage.constants';

/** Options matching `value`, or the first page when nothing is typed. */
export const getVisibleOptions = <T extends { label: string }>(
  options: T[],
  value: string
): T[] =>
  value
    ? options.filter((option) =>
        option.label.toLowerCase().includes(value.toLowerCase())
      )
    : options.slice(0, INITIAL_NODE_ITEMS_LENGTH);
