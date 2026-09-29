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
    getTeamsWithFqnPath
} from '../../../../../../utils/RouterUtils';
import type { AccessControlView } from './AccessControl.types';

const PATH_ROLES = 'roles';
const PATH_POLICIES = 'policies';

export const buildConditionOptions = (fns: Function[]): SelectItemType[] =>
  uniqBy(
    fns.flatMap((fn) =>
      (fn.examples ?? []).map((ex: string) => ({ id: ex, label: ex }))
    ),
    'id'
  );

export function hashSubPathToView(subPath: string): AccessControlView {
  if (!subPath) {
    return { type: 'landing' };
  }

  const parts = subPath.split('/');

  if (parts[0] === PATH_ROLES) {
    if (!parts[1]) {
      return { type: 'roles' };
    }

    if (parts[1] === 'add') {
      return { type: 'roles-add' };
    }

    return {
      type: 'roles-detail',
      fqn: parts.slice(1).join('/'),
      name: parts[1],
    };
  }

  if (parts[0] === PATH_POLICIES) {
    if (!parts[1]) {
      return { type: 'policies' };
    }

    if (parts[1] === 'add') {
      return { type: 'policies-add' };
    }

    return {
      type: 'policies-detail',
      fqn: parts.slice(1).join('/'),
      name: parts[1],
    };
  }

  if (parts[0] === 'permission-debugger') {
    return { type: 'permission-debugger' };
  }

  if (parts[0] === 'audit-logs') {
    return { type: 'audit-logs' };
  }

  return { type: 'landing' };
}

export function viewToSubPath(
  view: AccessControlView
): string | undefined {
  switch (view.type) {
    case 'landing':
      return undefined;
    case 'roles':
      return PATH_ROLES;
    case 'roles-add':
      return `${PATH_ROLES}/add`;
    case 'roles-detail':
      return `${PATH_ROLES}/${view.fqn}`;
    case 'policies':
      return PATH_POLICIES;
    case 'policies-add':
      return `${PATH_POLICIES}/add`;
    case 'policies-detail':
      return `${PATH_POLICIES}/${view.fqn}`;
    case 'permission-debugger':
      return 'permission-debugger';
    case 'audit-logs':
      return 'audit-logs';
    default:
      return undefined;
  }
}

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
