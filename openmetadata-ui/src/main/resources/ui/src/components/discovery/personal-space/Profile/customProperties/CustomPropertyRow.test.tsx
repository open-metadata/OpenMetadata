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
import { fireEvent, render, screen } from '@testing-library/react';
import { ComponentProps } from 'react';
import { NO_DATA_PLACEHOLDER } from '../../../../../constants/constants';
import { CustomProperty } from '../../../../../generated/type/customProperty';
import CustomPropertyRow from './CustomPropertyRow';

jest.mock('../../../../common/RichTextEditor/RichTextEditor', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <textarea aria-label="markdown-editor" data-testid="markdown-editor" />
    ))
);

const property = (typeName: string, name = 'costCenter') =>
  ({
    name,
    displayName: 'Cost Center',
    propertyType: { id: typeName, name: typeName, type: 'type' },
  } as CustomProperty);

const renderRow = (
  props: Partial<ComponentProps<typeof CustomPropertyRow>>
) => {
  const handlers = {
    onEdit: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  render(
    <CustomPropertyRow
      canEdit
      isEditing={false}
      isSaving={false}
      property={property('string')}
      value="CC-1"
      {...handlers}
      {...props}
    />
  );

  return handlers;
};

describe('CustomPropertyRow', () => {
  it('shows the no-data placeholder for an empty value', () => {
    renderRow({ value: undefined });

    expect(screen.getByTestId('no-value')).toHaveTextContent(
      NO_DATA_PLACEHOLDER
    );
  });

  it('shows the item count of a list-shaped value in the header', () => {
    renderRow({
      property: property('table-cp'),
      value: { columns: ['a'], rows: [{ a: '1' }, { a: '2' }] },
    });

    expect(screen.getByTestId('property-item-count')).toHaveTextContent('2');
  });

  it('enables Save only once the draft differs from the stored value', () => {
    renderRow({ isEditing: true });

    const save = screen.getByTestId('inline-save-btn');
    const input = screen.getByRole('textbox', { name: 'Cost Center' });

    expect(save).toBeDisabled();

    fireEvent.change(input, { target: { value: 'CC-2' } });

    expect(save).toBeEnabled();

    fireEvent.change(input, { target: { value: 'CC-1' } });

    expect(save).toBeDisabled();
  });

  it('calls onCancel from the Cancel button', () => {
    const { onCancel, onSave } = renderRow({ isEditing: true });

    fireEvent.click(screen.getByTestId('inline-cancel-btn'));

    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('puts a wide type editor full-width below the header row', () => {
    renderRow({ isEditing: true, property: property('markdown', 'notes') });

    const row = screen.getByTestId('custom-property-row-notes');

    expect(row).toContainElement(screen.getByTestId('custom-property-editor'));
    expect(screen.getByTestId('custom-property-editor').parentElement).toBe(
      row
    );
  });

  it('keeps a narrow type editor inside the header row', () => {
    renderRow({ isEditing: true });

    expect(screen.getByTestId('custom-property-editor').parentElement).not.toBe(
      screen.getByTestId('custom-property-row-costCenter')
    );
  });
});
