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

export interface LdapRoleMapping {
  id: string;
  ldapGroup: string;
  roles: string[];
}

export const parseLdapRoleMappings = (
  value: unknown,
  createId: () => string
): LdapRoleMapping[] => {
  if (typeof value !== 'string' || !value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as Record<string, string[]>;

    return Object.entries(parsed).map(([ldapGroup, roles]) => ({
      id: createId(),
      ldapGroup,
      roles,
    }));
  } catch {
    return [];
  }
};

/** Rows without a group DN are still being filled in and are left out. */
export const serializeLdapRoleMappings = (mappings: LdapRoleMapping[]) =>
  JSON.stringify(
    Object.fromEntries(
      mappings.filter((m) => m.ldapGroup).map((m) => [m.ldapGroup, m.roles])
    )
  );

/** Ids of rows whose group DN repeats another row's (case- and space-insensitive). */
export const findDuplicateLdapGroups = (
  mappings: LdapRoleMapping[]
): Set<string> => {
  const normalize = (group: string) => group.trim().toLowerCase();
  const counts = new Map<string, number>();
  for (const { ldapGroup } of mappings) {
    if (normalize(ldapGroup)) {
      counts.set(
        normalize(ldapGroup),
        (counts.get(normalize(ldapGroup)) ?? 0) + 1
      );
    }
  }

  return new Set(
    mappings
      .filter((m) => (counts.get(normalize(m.ldapGroup)) ?? 0) > 1)
      .map((m) => m.id)
  );
};
