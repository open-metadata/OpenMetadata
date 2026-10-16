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
import type { AccessControlView } from './AccessControl.types';

const PATH_ROLES = 'roles';
const PATH_POLICIES = 'policies';
const PATH_PERMISSION_DEBUGGER = 'permission-debugger';
const PATH_AUDIT_LOGS = 'audit-logs';
const PATH_RULES = 'rules';
const PATH_ADD = 'add';
const PATH_EDIT = 'edit';

const POLICIES_RULE = 'policies-rule' as const;

/**
 * `policies/<fqn>/rules/add` or `policies/<fqn>/rules/<rule>/edit`. Matched from
 * the end because the detail route takes every remaining segment as the FQN.
 */
const parsePolicyRulePath = (
  parts: string[]
): AccessControlView | undefined => {
  const rulesAt = parts.lastIndexOf(PATH_RULES);
  if (rulesAt < 2) {
    return undefined;
  }

  const fqn = parts.slice(1, rulesAt).join('/');
  const [first, second, ...extra] = parts.slice(rulesAt + 1);
  if (first === PATH_ADD && second === undefined) {
    return { type: POLICIES_RULE, fqn, name: fqn };
  }

  if (first && second === PATH_EDIT && extra.length === 0) {
    return {
      type: POLICIES_RULE,
      fqn,
      name: fqn,
      ruleName: decodeURIComponent(first),
    };
  }

  return undefined;
};

const policyRuleSubPath = (view: AccessControlView): string | undefined => {
  if (view.type !== POLICIES_RULE) {
    return undefined;
  }
  const rulesPath = `${PATH_POLICIES}/${view.fqn}/${PATH_RULES}`;

  return view.ruleName
    ? `${rulesPath}/${encodeURIComponent(view.ruleName)}/${PATH_EDIT}`
    : `${rulesPath}/${PATH_ADD}`;
};

const parsePoliciesPath = (parts: string[]): AccessControlView => {
  if (!parts[1]) {
    return { type: 'policies' };
  }

  if (parts[1] === PATH_ADD) {
    return { type: 'policies-add' };
  }

  return (
    parsePolicyRulePath(parts) ?? {
      type: 'policies-detail',
      fqn: parts.slice(1).join('/'),
      name: parts[1],
    }
  );
};

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
    return parsePoliciesPath(parts);
  }

  if (parts[0] === PATH_PERMISSION_DEBUGGER) {
    return { type: PATH_PERMISSION_DEBUGGER };
  }

  if (parts[0] === PATH_AUDIT_LOGS) {
    return { type: PATH_AUDIT_LOGS };
  }

  return { type: 'landing' };
}

export function viewToSubPath(view: AccessControlView): string | undefined {
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
    case PATH_PERMISSION_DEBUGGER:
      return PATH_PERMISSION_DEBUGGER;
    case PATH_AUDIT_LOGS:
      return PATH_AUDIT_LOGS;
    default:
      return policyRuleSubPath(view);
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
