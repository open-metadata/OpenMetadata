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
import { ENTITY_PATH } from '../constants/constants';

export const getCustomPropertyEntityPathname = (entityType: string) => {
  const entityPathEntries = Object.entries(ENTITY_PATH);
  const entityPath = entityPathEntries.find(([, path]) => path === entityType);

  return entityPath ? entityPath[0] : '';
};
