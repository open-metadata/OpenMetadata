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
import { ObjectFieldTemplateProps } from '@rjsf/utils';
import { partitionProperties } from './CoreObjectFieldTemplateUtils';

const property = (name: string) =>
  ({
    name,
    hidden: false,
    content: null,
  } as unknown as ObjectFieldTemplateProps['properties'][number]);

const schema = {
  type: 'object',
  properties: {
    clientId: { type: 'string' },
    useNonce: { type: 'string' },
    connectionArguments: { type: 'object' },
  },
} as ObjectFieldTemplateProps['schema'];

const names = (properties: ObjectFieldTemplateProps['properties']) =>
  properties.map((p) => p.name);

describe('partitionProperties', () => {
  const properties = [
    property('clientId'),
    property('useNonce'),
    property('connectionArguments'),
  ];

  it('moves the built-in advanced properties out of the main list', () => {
    const { normalProperties, advancedProperties } = partitionProperties(
      properties,
      schema,
      true,
      false
    );

    expect(names(normalProperties)).toEqual(['clientId', 'useNonce']);
    expect(names(advancedProperties)).toEqual(['connectionArguments']);
  });

  it('also moves the fields a form names as advanced', () => {
    const { normalProperties, advancedProperties } = partitionProperties(
      properties,
      schema,
      true,
      false,
      ['useNonce']
    );

    expect(names(normalProperties)).toEqual(['clientId']);
    expect(names(advancedProperties)).toEqual([
      'useNonce',
      'connectionArguments',
    ]);
  });
});
