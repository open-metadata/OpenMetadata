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
import { ObjectFieldTemplatePropertyType } from '@rjsf/utils';
import {
  getFieldGroups,
  getSsoGroupingFlags,
  partitionAdvancedProperties,
} from './SSOGroupedFieldTemplate.utils';

const property = (name: string, hidden = false) =>
  ({
    name,
    hidden,
    content: <div key={name}>{name}</div>,
  } as unknown as ObjectFieldTemplatePropertyType);

const names = (properties: ObjectFieldTemplatePropertyType[]) =>
  properties.map((p) => p.name);

describe('getSsoGroupingFlags', () => {
  it('groups only the SSO configuration objects', () => {
    expect(
      getSsoGroupingFlags('root/authenticationConfiguration')
    ).toMatchObject({ isAuthConfigRoot: true, shouldApplyGrouping: true });
    expect(
      getSsoGroupingFlags('root/authenticationConfiguration/samlConfiguration')
    ).toMatchObject({ isSAMLConfig: true, shouldApplyGrouping: true });
    expect(
      getSsoGroupingFlags(
        'root/authenticationConfiguration/samlConfiguration/idp'
      ).shouldApplyGrouping
    ).toBe(false);
  });
});

describe('getFieldGroups', () => {
  it('splits the authentication root into the classic groups, dropping hidden fields', () => {
    const groups = getFieldGroups(
      [
        property('providerName'),
        property('clientType'),
        property('clientId', true),
        property('authority'),
        property('oidcConfiguration'),
        property('emailClaim'),
        property('somethingElse'),
      ],
      getSsoGroupingFlags('root/authenticationConfiguration')
    );

    expect(groups.map((g) => names(g.properties))).toEqual([
      ['providerName'],
      ['clientType'],
      ['authority'],
      ['oidcConfiguration'],
      ['emailClaim'],
      ['somethingElse'],
    ]);
  });

  it('collects deprecated authorizer fields into their own group', () => {
    const groups = getFieldGroups(
      [
        property('adminEmails'),
        property('adminPrincipals'),
        property('principalDomain'),
      ],
      getSsoGroupingFlags('root/authorizerConfiguration')
    );

    expect(groups.map((g) => g.title)).toEqual([
      'Admin Management',
      'Legacy Configuration (Deprecated)',
    ]);
  });
});

describe('partitionAdvancedProperties', () => {
  it('separates advanced properties from the rest, keeping order', () => {
    const { advancedProperties, normalProperties } =
      partitionAdvancedProperties([
        property('clientId'),
        property('connectionArguments'),
        property('scope'),
      ]);

    expect(names(advancedProperties)).toEqual(['connectionArguments']);
    expect(names(normalProperties)).toEqual(['clientId', 'scope']);
  });
});
