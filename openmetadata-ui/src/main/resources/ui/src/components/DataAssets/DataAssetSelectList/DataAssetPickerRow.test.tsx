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
import React from 'react';
import { DataAssetPickerOption } from './DataAssetPicker.interface';
import DataAssetPickerRow from './DataAssetPickerRow';

jest.mock('../../../utils/Assets/AssetsUtils', () => ({
  getEntityIconWithBg: jest.fn().mockReturnValue(<span>icon</span>),
}));

const OPTION: DataAssetPickerOption = {
  id: 'sample_data.ecommerce_db.shopify.dim_address',
  label: 'dim_address',
  displayName: 'Dim Address',
  name: 'dim_address',
  type: 'table',
};

describe('DataAssetPickerRow', () => {
  it('renders displayName as the primary title', () => {
    render(
      <DataAssetPickerRow
        isFocused={false}
        isSelected={false}
        option={OPTION}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('Dim Address')).toBeInTheDocument();
  });

  it('falls back to name when displayName is absent', () => {
    const opt: DataAssetPickerOption = { ...OPTION, displayName: undefined };
    render(
      <DataAssetPickerRow
        isFocused={false}
        isSelected={false}
        option={opt}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('dim_address')).toBeInTheDocument();
  });

  it('falls back to label when displayName and name are absent', () => {
    const opt: DataAssetPickerOption = {
      ...OPTION,
      displayName: undefined,
      name: undefined,
    };
    render(
      <DataAssetPickerRow
        isFocused={false}
        isSelected={false}
        option={opt}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('dim_address')).toBeInTheDocument();
  });

  it('renders the entity type badge when type is provided', () => {
    render(
      <DataAssetPickerRow
        isFocused={false}
        isSelected={false}
        option={OPTION}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('table')).toBeInTheDocument();
  });

  it('renders the entity icon when type is provided', () => {
    render(
      <DataAssetPickerRow
        isFocused={false}
        isSelected={false}
        option={OPTION}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('icon')).toBeInTheDocument();
  });

  it('renders the id as secondary text', () => {
    render(
      <DataAssetPickerRow
        isFocused={false}
        isSelected={false}
        option={OPTION}
        onSelect={jest.fn()}
      />
    );

    expect(
      screen.getByText('sample_data.ecommerce_db.shopify.dim_address')
    ).toBeInTheDocument();
  });

  it('shows a check icon when isSelected is true', () => {
    const { container } = render(
      <DataAssetPickerRow
        isSelected
        isFocused={false}
        option={OPTION}
        onSelect={jest.fn()}
      />
    );

    // Check icon is rendered as an svg inside the button when selected
    const button = container.querySelector('button')!;

    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('applies selected background class when isSelected is true', () => {
    const { container } = render(
      <DataAssetPickerRow
        isSelected
        isFocused={false}
        option={OPTION}
        onSelect={jest.fn()}
      />
    );

    expect(container.querySelector('button')?.className).toContain(
      'tw:bg-brand-primary'
    );
  });

  it('applies focused background class when isFocused is true and not selected', () => {
    const { container } = render(
      <DataAssetPickerRow
        isFocused
        isSelected={false}
        option={OPTION}
        onSelect={jest.fn()}
      />
    );

    expect(container.querySelector('button')?.className).toContain(
      'tw:bg-utility-gray-blue-50'
    );
  });

  it('calls onSelect with the option when clicked', () => {
    const onSelect = jest.fn();
    render(
      <DataAssetPickerRow
        isFocused={false}
        isSelected={false}
        option={OPTION}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(OPTION);
  });

  it('does not apply selected class when isSelected is false', () => {
    const { container } = render(
      <DataAssetPickerRow
        isFocused={false}
        isSelected={false}
        option={OPTION}
        onSelect={jest.fn()}
      />
    );

    expect(container.querySelector('button')?.className).not.toContain(
      'tw:bg-brand-primary'
    );
  });
});
