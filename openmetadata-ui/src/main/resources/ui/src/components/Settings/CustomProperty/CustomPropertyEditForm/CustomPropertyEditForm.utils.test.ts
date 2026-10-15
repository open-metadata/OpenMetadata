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

  it('seeds an empty displayName for a property that has none', () => {
    // displayName is optional on AddCustomProperty; properties routinely
    // exist without it. The form seeds '' so the field is editable, but
    // getCustomPropertyChanges must treat an unchanged '' as a no-op (below).
    expect(getEditFormValues(stringProperty).displayName).toBe('');
  });
});

describe('getCustomPropertyChanges', () => {
  it('builds an enum config with de-duplicated values', () => {
    // displayName 'Priority' is unchanged from enumProperty, so it is a no-op
    // and is left out of the changes (see the displayName describe block below).
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

describe('getCustomPropertyChanges displayName no-op', () => {
  // `getEditFormValues` seeds displayName as `property.displayName ?? ''`, so a
  // property without a displayName reads back as ''. Returning that '' would
  // make updateCustomPropertyByName emit an `add /displayName ""` op and
  // silently persist an empty displayName on an unrelated edit. An unchanged
  // displayName must therefore be emitted as `undefined` (omitted by omitBy).
  it('emits undefined when an unchanged property had no displayName (seeded as "")', () => {
    const changes = getCustomPropertyChanges(stringProperty, {
      displayName: '', // unchanged: property has no displayName, seeded as ''
      description: 'Owner',
    });

    expect(changes.displayName).toBeUndefined();
  });

  it('emits undefined when an unchanged property had a displayName', () => {
    const changes = getCustomPropertyChanges(enumProperty, {
      displayName: 'Priority', // unchanged
      description: 'How urgent',
      enumConfig: [{ id: 'High', label: 'High' }],
    });

    expect(changes.displayName).toBeUndefined();
  });

  it('emits the new value when displayName changes from "" to a value', () => {
    const changes = getCustomPropertyChanges(stringProperty, {
      displayName: 'Owner', // changed from undefined (seeded as '')
      description: 'Owner',
    });

    expect(changes.displayName).toBe('Owner');
  });

  it('emits the new value when displayName changes between two values', () => {
    const changes = getCustomPropertyChanges(enumProperty, {
      displayName: 'Priority Level', // changed from 'Priority'
      description: 'How urgent',
      enumConfig: [{ id: 'High', label: 'High' }],
    });

    expect(changes.displayName).toBe('Priority Level');
  });
});
