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
import { CustomProperty } from '../../../../generated/type/customProperty';
import {
  getCustomPropertyChanges,
  getEditFormValues,
} from './CustomPropertyEditForm.utils';

const enumProperty: CustomProperty = {
  name: 'priority',
  displayName: 'Priority',
  description: 'How urgent',
  propertyType: { id: 'enum', type: 'type', name: 'enum' },
  customPropertyConfig: {
    config: { multiSelect: false, values: ['High', 'Low'] },
  },
};

const entityRefProperty: CustomProperty = {
  name: 'steward',
  description: 'Data steward',
  propertyType: {
    id: 'ref',
    type: 'type',
    name: 'entityReferenceList',
  },
  customPropertyConfig: { config: ['user', 'unknownType'] },
};

const stringProperty: CustomProperty = {
  name: 'owner',
  description: 'Owner',
  propertyType: { id: 'string', type: 'type', name: 'string' },
};

describe('getEditFormValues', () => {
  it('seeds enum values and the multi-select flag', () => {
    expect(getEditFormValues(enumProperty)).toEqual({
      displayName: 'Priority',
      description: 'How urgent',
      enumConfig: [
        { id: 'High', label: 'High' },
        { id: 'Low', label: 'Low' },
      ],
      multiSelect: false,
      entityReferenceConfig: [],
    });
  });

  it('seeds entity reference types with their option labels', () => {
    expect(getEditFormValues(entityRefProperty).entityReferenceConfig).toEqual([
      { id: 'user', label: 'User' },
      { id: 'unknownType', label: 'unknownType' },
    ]);
  });
});

describe('getCustomPropertyChanges', () => {
  it('builds an enum config with de-duplicated values', () => {
    expect(
      getCustomPropertyChanges(enumProperty, {
        displayName: 'Priority',
        description: 'How urgent',
        multiSelect: true,
        enumConfig: [
          { id: 'High', label: 'High' },
          { id: 'High', label: 'High' },
          { id: 'Medium', label: 'Medium' },
        ],
      })
    ).toEqual({
      displayName: 'Priority',
      description: 'How urgent',
      customPropertyConfig: {
        config: { multiSelect: true, values: ['High', 'Medium'] },
      },
    });
  });

  it('adds newly picked entity reference types to the saved ones', () => {
    expect(
      getCustomPropertyChanges(entityRefProperty, {
        description: 'Data steward',
        entityReferenceConfig: [
          { id: 'user', label: 'User' },
          { id: 'team', label: 'Team' },
        ],
      }).customPropertyConfig
    ).toEqual({ config: ['user', 'unknownType', 'team'] });
  });

  it('keeps saved entity reference types that were dropped from the selection', () => {
    expect(
      getCustomPropertyChanges(entityRefProperty, {
        description: 'Data steward',
        entityReferenceConfig: [{ id: 'team', label: 'Team' }],
      }).customPropertyConfig
    ).toEqual({ config: ['user', 'unknownType', 'team'] });
  });

  it('leaves the config untouched for other types', () => {
    expect(
      getCustomPropertyChanges(stringProperty, {
        displayName: 'Owner',
        description: 'Owner',
      }).customPropertyConfig
    ).toBeUndefined();
  });
});
