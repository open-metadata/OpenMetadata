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
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityNameUtils';

/** The options of one tab whose display or login name contains the text. */
export const searchOptions = (
  options: EntityReference[],
  type: EntityType,
  searchText: string
) => {
  const text = searchText.toLowerCase();
  const data = options.filter(
    (option) =>
      option.type === type &&
      (getEntityName(option).toLowerCase().includes(text) ||
        option.name?.toLowerCase().includes(text))
  );

  return { data, paging: { total: data.length } };
};

export const getTabCounts = (
  searchedCounts: { user: number; team: number },
  options?: EntityReference[]
) =>
  options
    ? {
        user: options.filter((option) => option.type === EntityType.USER)
          .length,
        team: options.filter((option) => option.type === EntityType.TEAM)
          .length,
      }
    : searchedCounts;
