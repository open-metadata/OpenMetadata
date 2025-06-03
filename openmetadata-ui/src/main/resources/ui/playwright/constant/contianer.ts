/*
 *  Copyright 2025 Collate.
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
import { uuid } from '../utils/common';

export const CONTAINER_CHILDREN = Array.from({ length: 25 }, (_, i) => {
  const id = uuid();

  return {
    name: `pw-container-children${i + 1}-${id}`,
    displayName: `pw-container-children-${i + 1}-${id}`,
  };
});
