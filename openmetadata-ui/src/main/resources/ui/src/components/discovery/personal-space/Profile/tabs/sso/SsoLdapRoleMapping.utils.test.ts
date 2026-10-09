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
import {
  findDuplicateLdapGroups,
  parseLdapRoleMappings,
  serializeLdapRoleMappings,
} from './SsoLdapRoleMapping.utils';

const idFactory = () => {
  let next = 0;

  return () => `id-${++next}`;
};

describe('parseLdapRoleMappings', () => {
  it('turns the stored JSON into one row per group', () => {
    expect(
      parseLdapRoleMappings(
        JSON.stringify({ 'cn=admins': ['Admin'], 'cn=eng': ['DataSteward'] }),
        idFactory()
      )
    ).toEqual([
      { id: 'id-1', ldapGroup: 'cn=admins', roles: ['Admin'] },
      { id: 'id-2', ldapGroup: 'cn=eng', roles: ['DataSteward'] },
    ]);
  });

  it('starts empty for a missing or malformed value', () => {
    expect(parseLdapRoleMappings(undefined, idFactory())).toEqual([]);
    expect(parseLdapRoleMappings('{not json', idFactory())).toEqual([]);
  });
});

describe('serializeLdapRoleMappings', () => {
  it('writes rows back as a group → roles object, skipping rows without a group', () => {
    expect(
      JSON.parse(
        serializeLdapRoleMappings([
          { id: '1', ldapGroup: 'cn=admins', roles: ['Admin'] },
          { id: '2', ldapGroup: '', roles: ['DataConsumer'] },
        ])
      )
    ).toEqual({ 'cn=admins': ['Admin'] });
  });
});

describe('findDuplicateLdapGroups', () => {
  it('flags every row sharing a group, ignoring case and surrounding spaces', () => {
    expect(
      findDuplicateLdapGroups([
        { id: '1', ldapGroup: 'cn=Admins', roles: [] },
        { id: '2', ldapGroup: ' cn=admins ', roles: [] },
        { id: '3', ldapGroup: 'cn=eng', roles: [] },
        { id: '4', ldapGroup: '', roles: [] },
        { id: '5', ldapGroup: '', roles: [] },
      ])
    ).toEqual(new Set(['1', '2']));
  });
});
