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

import { SelectItemType } from '@openmetadata/ui-core-components';
import { uniqBy } from 'lodash';
import { EntityType } from '../../../../../../enums/entity.enum';
import { Function } from '../../../../../../generated/type/function';
import {
  getEntityDetailsPath,
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
  getTeamsWithFqnPath,
} from '../../../../../../utils/RouterUtils';

export const buildConditionOptions = (fns: Function[]): SelectItemType[] =>
  uniqBy(
    fns.flatMap((fn) =>
      (fn.examples ?? []).map((ex: string) => ({ id: ex, label: ex }))
    ),
    'id'
  );

export const getEntityLink = (entityType: string, fqn: string): string => {
  switch (entityType) {
    case EntityType.POLICY:
      return getPolicyWithFqnPath(fqn);
    case EntityType.ROLE:
      return getRoleWithFqnPath(fqn);
    case EntityType.TEAM:
      return getTeamsWithFqnPath(fqn);
    default:
      return getEntityDetailsPath(entityType as EntityType, fqn);
  }
};
