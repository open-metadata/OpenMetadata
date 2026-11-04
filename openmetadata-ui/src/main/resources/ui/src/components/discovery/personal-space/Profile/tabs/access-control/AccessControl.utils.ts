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
import { safeDecodeURIComponent } from '../../../../../../utils/SettingsHashUtils';
import { getSettingsLink } from '../../../../../../utils/SettingsModalLinkUtils';
import type { AccessControlView } from './AccessControl.types';

const PATH_ROLES = 'roles';
const PATH_POLICIES = 'policies';
const PATH_PERMISSION_DEBUGGER = 'permission-debugger';
const PATH_AUDIT_LOGS = 'audit-logs';
const PATH_RULES = 'rules';
const PATH_ADD = 'add';
const PATH_EDIT = 'edit';

const POLICIES_RULE = 'policies-rule' as const;
const ROLES_DETAIL = 'roles-detail' as const;
const POLICIES_DETAIL = 'policies-detail' as const;

// Role, policy and rule names travel URL-encoded in the hash and are decoded
// once here (see `safeDecodeURIComponent`). A legacy unencoded FQN spanning
// several segments is joined back before decoding.
const decodeFqn = (parts: string[]) => safeDecodeURIComponent(parts.join('/'));

/**
 * `policies/<fqn>/rules/add` or `policies/<fqn>/rules/<rule>/edit`. Matched from
 * the end because the detail route takes every remaining segment as the FQN.
 */
const parsePolicyRulePath = (
  parts: string[]
): AccessControlView | undefined => {
  // Matched by the route's tail shape, not by where `rules` last appears: a rule
  // can itself be named `rules`.
  if (
    parts.length > 4 &&
    parts.at(-1) === PATH_EDIT &&
    parts.at(-3) === PATH_RULES
  ) {
    const fqn = decodeFqn(parts.slice(1, -3));

    return {
      type: POLICIES_RULE,
      fqn,
      name: fqn,
      ruleName: safeDecodeURIComponent(parts.at(-2) ?? ''),
    };
  }

  if (
    parts.length > 3 &&
    parts.at(-1) === PATH_ADD &&
    parts.at(-2) === PATH_RULES
  ) {
    const fqn = decodeFqn(parts.slice(1, -2));

    return { type: POLICIES_RULE, fqn, name: fqn };
  }

  return undefined;
};

const policyRuleSubPath = (view: AccessControlView): string | undefined => {
  if (view.type !== POLICIES_RULE) {
    return undefined;
  }
  const rulesPath = `${PATH_POLICIES}/${encodeURIComponent(
    view.fqn
  )}/${PATH_RULES}`;

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

  const fqn = decodeFqn(parts.slice(1));

  return (
    parsePolicyRulePath(parts) ?? { type: POLICIES_DETAIL, fqn, name: fqn }
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

    const fqn = decodeFqn(parts.slice(1));

    return { type: ROLES_DETAIL, fqn, name: fqn };
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
    case ROLES_DETAIL:
      return `${PATH_ROLES}/${encodeURIComponent(view.fqn)}`;
    case 'policies':
      return PATH_POLICIES;
    case 'policies-add':
      return `${PATH_POLICIES}/add`;
    case POLICIES_DETAIL:
      return `${PATH_POLICIES}/${encodeURIComponent(view.fqn)}`;
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
      return getSettingsLink(getPolicyWithFqnPath(fqn));
    case EntityType.ROLE:
      return getSettingsLink(getRoleWithFqnPath(fqn));
    case EntityType.TEAM:
      return getSettingsLink(getTeamsWithFqnPath(fqn));
    default:
      return getEntityDetailsPath(entityType as EntityType, fqn);
  }
};

/** A tab label with the number of entities it lists, e.g. "Policies (3)". */
export const getCountLabel = (label: string, refs?: unknown[]) =>
  `${label} (${refs?.length ?? 0})`;

// The entity a header names: a fetched display name wins over the URL's FQN.
export const getDetailHeaderNames = (
  view: AccessControlView,
  resolvedName: string
) => {
  const isDetailView =
    view.type === ROLES_DETAIL || view.type === POLICIES_DETAIL;
  const isPolicyView =
    view.type === POLICIES_DETAIL || view.type === POLICIES_RULE;
  const urlName = 'name' in view ? view.name : '';

  return {
    isDetailView,
    roleName: view.type === ROLES_DETAIL ? resolvedName || urlName : '',
    policyName: isPolicyView ? resolvedName || urlName : '',
  };
};

/**
 * Classic keeps Roles, Policies and the permission debugger admin-only, while
 * Audit Logs also opens to holders of the AuditLogs permission (the only way a
 * non-admin reaches this panel).
 */
export const isAccessControlViewAllowed = (
  viewType: AccessControlView['type'],
  isAdmin: boolean
): boolean => isAdmin || viewType === 'landing' || viewType === 'audit-logs';
