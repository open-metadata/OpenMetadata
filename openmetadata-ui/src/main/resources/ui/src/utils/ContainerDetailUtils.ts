/*
 *  Copyright 2023 Collate.
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
import {
  PLACEHOLDER_CONTAINER_NAME,
  PLACEHOLDER_ROUTE_TAB,
  ROUTES,
} from 'constants/constants';

export const getContainerDetailPath = (containerFQN: string, tab?: string) => {
  let path = tab ? ROUTES.CONTAINER_DETAILS_WITH_TAB : ROUTES.CONTAINER_DETAILS;
  path = path.replace(PLACEHOLDER_CONTAINER_NAME, containerFQN);

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  return path;
};
