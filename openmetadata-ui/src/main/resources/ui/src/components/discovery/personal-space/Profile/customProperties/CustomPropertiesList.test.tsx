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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EntityType } from '../../../../../enums/entity.enum';
import { CustomProperty } from '../../../../../generated/type/customProperty';
import { useEntityTypeCustomProperties } from '../../../../../hooks/useEntityTypeCustomProperties';
import CustomPropertiesList from './CustomPropertiesList';

jest.mock('../../../../../hooks/useEntityTypeCustomProperties', () => ({
  useEntityTypeCustomProperties: jest.fn(),
}));

const PROPERTIES = [
  {
    name: 'costCenter',
    displayName: 'Cost Center',
    propertyType: { id: 't1', name: 'string', type: 'type' },
  },
] as CustomProperty[];

const mockDefinitions = (isLoading = false) =>
  (useEntityTypeCustomProperties as jest.Mock).mockReturnValue({
    customProperties: isLoading ? [] : PROPERTIES,
    isLoading,
  });

const renderList = (onUpdate = jest.fn().mockResolvedValue(true)) => {
  render(
    <CustomPropertiesList
      canEdit
      canView
      entityType={EntityType.TEAM}
      extension={{ costCenter: 'CC-1', budget: 10 }}
      onUpdate={onUpdate}
    />
  );

  return onUpdate;
};

describe('CustomPropertiesList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads the team definitions and saves into the team extension', async () => {
    mockDefinitions();
    const onUpdate = renderList();

    expect(useEntityTypeCustomProperties).toHaveBeenCalledWith(EntityType.TEAM);

    fireEvent.click(screen.getByTestId('edit-costCenter'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Cost Center' }), {
      target: { value: 'CC-2' },
    });
    fireEvent.click(screen.getByTestId('inline-save-btn'));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({ costCenter: 'CC-2', budget: 10 })
    );
  });

  it('shows the skeleton while the definitions load', () => {
    mockDefinitions(true);
    renderList();

    expect(screen.getByTestId('custom-properties-loading')).toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-properties-list')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-properties-empty')
    ).not.toBeInTheDocument();
  });
});
