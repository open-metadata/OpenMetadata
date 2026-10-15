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
import { DOMAIN_ONLY_ACCESS_ROLE } from '../constants/constants';
import { User } from '../generated/entity/teams/user';
import { EntityReference } from '../generated/entity/type';

export const isDomainRestrictedUser = (user?: User): boolean => {
  if (!user || user.isAdmin) {
    return false;
  }

  const allRoles = [...(user.roles ?? []), ...(user.inheritedRoles ?? [])];

  return allRoles.some((role) => role.name === DOMAIN_ONLY_ACCESS_ROLE);
};

export const getUserDomainOptions = (user?: User): EntityReference[] =>
  user?.domains ?? [];

/**
 * A domain is in scope when it *is* an allowed domain or sits beneath one.
 * Exported so tree-shaped callers (DomainSelect) can apply the same rule to
 * their own node shape instead of re-implementing the prefix match.
 */
export const isDomainFqnAllowed = (
  fqn: string | undefined,
  allowedFqns: string[]
): boolean => {
  if (!fqn) {
    return false;
  }

  return allowedFqns.some(
    (allowedFqn) => fqn === allowedFqn || fqn.startsWith(`${allowedFqn}.`)
  );
};

/** FQNs of the domains a restricted user may use, with blanks dropped. */
export const toAllowedFqns = (allowed: EntityReference[]): string[] =>
  allowed
    .map((domain) => domain.fullyQualifiedName)
    .filter((fqn): fqn is string => Boolean(fqn));

export const filterDomainsToAllowed = <
  T extends { fullyQualifiedName?: string }
>(
  domains: T[],
  allowed: EntityReference[]
): T[] => {
  if (allowed.length === 0) {
    return [];
  }

  const allowedFqns = toAllowedFqns(allowed);

  return domains.filter((domain) =>
    isDomainFqnAllowed(domain.fullyQualifiedName, allowedFqns)
  );
};
