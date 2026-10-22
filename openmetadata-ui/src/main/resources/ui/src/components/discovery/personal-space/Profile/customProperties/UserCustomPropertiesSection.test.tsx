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
import { ResourceEntity } from '../../../../../enums/permissions.enum';
import { User } from '../../../../../generated/entity/teams/user';
import { CustomProperty } from '../../../../../generated/type/customProperty';
import { useEntityTypeCustomProperties } from '../../../../../hooks/useEntityTypeCustomProperties';
import { useUserCustomPropertyAccess } from './useUserCustomPropertyAccess';
import UserCustomPropertiesSection from './UserCustomPropertiesSection';

const mockSetHash = jest.fn();
let mockPermissions = {};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

jest.mock('./useUserCustomPropertyAccess', () => ({
  useUserCustomPropertyAccess: jest.fn(),
}));

jest.mock('../../../../../hooks/useEntityTypeCustomProperties', () => ({
  useEntityTypeCustomProperties: jest.fn(),
}));

jest.mock('../../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({ setHash: mockSetHash }),
}));

jest.mock(
  '../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: () => ({ permissions: mockPermissions }),
  })
);

jest.mock(
  '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyEditModal',
  () => ({
    CustomPropertyEditModal: ({
      onSave,
    }: {
      onSave: (value: unknown) => void;
    }) => (
      <button
        data-testid="custom-property-edit-modal"
        onClick={() => onSave('')}>
        save
      </button>
    ),
  })
);

const PROPERTIES = Array.from({ length: 7 }, (_, index) => ({
  name: `prop${index}`,
  displayName: `Prop ${index}`,
  description: `<p>Description ${index}</p>`,
  propertyType: { id: 't1', name: 'string', type: 'type' },
})) as CustomProperty[];

const USER = {
  id: 'u1',
  name: 'alice',
  email: 'alice@x.io',
  extension: { prop0: 'Senior Data Engineer', prop1: 'E-1' },
} as User;

const mockAccess = (canView: boolean, canEdit: boolean) =>
  (useUserCustomPropertyAccess as jest.Mock).mockReturnValue({
    canView,
    canEdit,
    isLoading: false,
  });

const mockDefinitions = (customProperties: CustomProperty[]) =>
  (useEntityTypeCustomProperties as jest.Mock).mockReturnValue({
    customProperties,
    isLoading: false,
  });

const renderSection = (onUpdate = jest.fn().mockResolvedValue(undefined)) =>
  render(<UserCustomPropertiesSection user={USER} onUpdate={onUpdate} />);

describe('UserCustomPropertiesSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions = {};
    mockDefinitions(PROPERTIES);
    mockAccess(true, true);
  });

  it('renders nothing without view permission', () => {
    mockAccess(false, false);

    const { container } = renderSection();

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when users have no custom properties', () => {
    mockDefinitions([]);

    const { container } = renderSection();

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the header, row title, plain-text description and value', () => {
    renderSection();

    expect(
      screen.getByText('message.custom-properties-additional-details')
    ).toBeInTheDocument();
    expect(screen.getByText('Prop 0')).toBeInTheDocument();
    expect(screen.getByText('Description 0')).toBeInTheDocument();
    expect(screen.getByText('Senior Data Engineer')).toBeInTheDocument();
    expect(screen.getAllByTestId('no-value')[0]).toHaveTextContent('—');
  });

  it('shows the first 5 rows and toggles the rest', () => {
    renderSection();

    expect(screen.getByTestId('custom-property-row-prop4')).toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-property-row-prop5')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('label.show-all-count:7'));

    expect(screen.getByTestId('custom-property-row-prop6')).toBeInTheDocument();

    fireEvent.click(screen.getByText('label.show-less-lowercase'));

    expect(
      screen.queryByTestId('custom-property-row-prop6')
    ).not.toBeInTheDocument();
  });

  it('hides the toggle with 5 or fewer properties', () => {
    mockDefinitions(PROPERTIES.slice(0, 5));

    renderSection();

    expect(
      screen.queryByTestId('toggle-all-custom-properties')
    ).not.toBeInTheDocument();
  });

  it('hides the pencils without edit permission', () => {
    mockAccess(true, false);

    renderSection();

    expect(screen.queryByTestId('edit-prop0')).not.toBeInTheDocument();
  });

  it('removes a cleared value from the extension on save', async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);

    renderSection(onUpdate);
    fireEvent.click(screen.getByTestId('edit-prop0'));
    fireEvent.click(screen.getByTestId('custom-property-edit-modal'));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        { extension: { prop1: 'E-1' } },
        'extension'
      )
    );
  });

  it('hides "Manage fields" without type view permission', () => {
    renderSection();

    expect(
      screen.queryByTestId('manage-custom-properties')
    ).not.toBeInTheDocument();
  });

  it('opens the user custom properties settings from "Manage fields"', () => {
    mockPermissions = { [ResourceEntity.TYPE]: { ViewBasic: true } };

    renderSection();
    fireEvent.click(screen.getByTestId('manage-custom-properties'));

    expect(mockSetHash).toHaveBeenCalledWith('custom-properties', 'user');
  });
});
