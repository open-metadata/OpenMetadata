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
import { render, screen } from '@testing-library/react';
import { ListBox } from 'react-aria-components';
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

const renderInListBox = (
  option: DataAssetPickerOption,
  selectedKeys: string[] = []
) =>
  render(
    <ListBox
      aria-label="test"
      selectedKeys={selectedKeys}
      selectionMode="multiple">
      <DataAssetPickerRow option={option} />
    </ListBox>
  );

describe('DataAssetPickerRow', () => {
  it('renders displayName as the primary title', () => {
    renderInListBox(OPTION);

    expect(screen.getByText('Dim Address')).toBeInTheDocument();
  });

  it('falls back to name when displayName is absent', () => {
    renderInListBox({ ...OPTION, displayName: undefined });

    expect(screen.getByText('dim_address')).toBeInTheDocument();
  });

  it('falls back to label when displayName and name are absent', () => {
    renderInListBox({ ...OPTION, displayName: undefined, name: undefined });

    expect(screen.getByText('dim_address')).toBeInTheDocument();
  });

  it('renders the entity type badge when type is provided', () => {
    renderInListBox(OPTION);

    expect(screen.getByText('table')).toBeInTheDocument();
  });

  it('renders the entity icon when type is provided', () => {
    renderInListBox(OPTION);

    expect(screen.getByText('icon')).toBeInTheDocument();
  });

  it('renders the id as secondary text', () => {
    renderInListBox(OPTION);

    expect(
      screen.getByText('sample_data.ecommerce_db.shopify.dim_address')
    ).toBeInTheDocument();
  });

  it('shows a check icon when the item is selected', () => {
    renderInListBox(OPTION, [OPTION.id]);

    expect(screen.getByRole('option', { selected: true })).toBeInTheDocument();
  });

  it('does not show a check icon when the item is not selected', () => {
    renderInListBox(OPTION, []);

    expect(
      screen.getByRole('option', { selected: false })
    ).toBeInTheDocument();
  });
});
