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
import { renderHook } from '@testing-library/react';
import { useEntityTypeCustomProperties } from '../../../hooks/useEntityTypeCustomProperties';
import { useHeaderCustomProperties } from './useHeaderCustomProperties';

jest.mock('../../../hooks/useEntityTypeCustomProperties', () => ({
  useEntityTypeCustomProperties: jest.fn(),
}));

jest.mock('./HeaderCustomPropertyEditor', () =>
  jest.fn().mockImplementation(() => null)
);

jest.mock(
  '../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyRenderers',
  () => ({ getPropertyRenderer: () => ({ View: () => null }) })
);

const mockUseGenericContext = jest.fn();

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: () => mockUseGenericContext(),
}));

const mockUseEntityTypeCustomProperties =
  useEntityTypeCustomProperties as jest.Mock;

const customProperties = [
  {
    name: 'steward',
    displayName: 'Data Steward',
    propertyType: {
      id: 'u',
      type: 'type',
      name: 'string',
      displayName: 'String',
    },
  },
  {
    name: 'sla',
    propertyType: { id: 'i', type: 'type', name: 'integer' },
  },
];

describe('useHeaderCustomProperties', () => {
  beforeEach(() => {
    mockUseEntityTypeCustomProperties.mockReturnValue({ customProperties });
    mockUseGenericContext.mockReturnValue({ onUpdate: jest.fn() });
  });

  it('skips the type fetch when the header pins no custom property', () => {
    renderHook(() =>
      useHeaderCustomProperties({
        entityType: 'table',
        entityHeader: { properties: ['owners'] },
        listAll: false,
        canEdit: false,
      })
    );

    expect(mockUseEntityTypeCustomProperties).toHaveBeenCalledWith(undefined);
  });

  it.each([
    ['the header pins one', { properties: ['extension.sla'] }, false],
    ['the customize page lists them all', undefined, true],
  ])('fetches the type when %s', (_case, entityHeader, listAll) => {
    renderHook(() =>
      useHeaderCustomProperties({
        entityType: 'table',
        entityHeader,
        listAll,
        canEdit: false,
      })
    );

    expect(mockUseEntityTypeCustomProperties).toHaveBeenCalledWith('table');
  });

  it('maps each custom property to a header property', () => {
    const { result } = renderHook(() =>
      useHeaderCustomProperties({
        entityType: 'table',
        extension: { steward: 'Karan' },
        listAll: true,
        canEdit: true,
      })
    );

    expect(
      result.current.map(
        ({ content: _content, renderEditor: _renderEditor, ...rest }) => rest
      )
    ).toEqual([
      {
        id: 'extension.steward',
        label: 'Data Steward',
        customPropertyType: 'String',
        isReadOnly: false,
        isEmpty: false,
        testId: 'header-custom-property-steward',
        editorTestId: 'edit-custom-property-value',
      },
      {
        id: 'extension.sla',
        label: 'sla',
        customPropertyType: 'integer',
        isReadOnly: false,
        isEmpty: true,
        testId: 'header-custom-property-sla',
        editorTestId: 'edit-custom-property-value',
      },
    ]);
    expect(result.current[0].renderEditor).toBeDefined();
  });

  it.each([
    ['the user cannot edit custom properties', false, { onUpdate: jest.fn() }],
    ['the page cannot save the entity', true, {}],
  ])('offers no editor when %s', (_case, canEdit, context) => {
    mockUseGenericContext.mockReturnValue(context);

    const { result } = renderHook(() =>
      useHeaderCustomProperties({ entityType: 'table', listAll: true, canEdit })
    );

    expect(result.current[0].renderEditor).toBeUndefined();
  });
});
