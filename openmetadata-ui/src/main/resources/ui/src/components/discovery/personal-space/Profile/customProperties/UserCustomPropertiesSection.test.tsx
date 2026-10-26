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
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { NO_DATA_PLACEHOLDER } from '../../../../../constants/constants';
import { User } from '../../../../../generated/entity/teams/user';
import { CustomProperty } from '../../../../../generated/type/customProperty';
import { useUserCustomPropertyAccess } from '../../../../../hooks/discovery/personal-space/useUserCustomPropertyAccess';
import { useEntityTypeCustomProperties } from '../../../../../hooks/useEntityTypeCustomProperties';
import UserCustomPropertiesSection from './UserCustomPropertiesSection';

const mockSetHash = jest.fn();
let mockIsAdmin = false;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

jest.mock(
  '../../../../../hooks/discovery/personal-space/useUserCustomPropertyAccess',
  () => ({
    useUserCustomPropertyAccess: jest.fn(),
  })
);

jest.mock('../../../../../hooks/useEntityTypeCustomProperties', () => ({
  useEntityTypeCustomProperties: jest.fn(),
}));

jest.mock('../../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({ setHash: mockSetHash }),
}));

jest.mock('../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));

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

const renderSection = (onUpdate = jest.fn().mockResolvedValue(true)) =>
  render(<UserCustomPropertiesSection user={USER} onUpdate={onUpdate} />);

describe('UserCustomPropertiesSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdmin = false;
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
    expect(screen.getAllByTestId('no-value')[0]).toHaveTextContent(
      NO_DATA_PLACEHOLDER
    );
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

  const editInline = (value: string) => {
    fireEvent.click(screen.getByTestId('edit-prop0'));
    const row = screen.getByTestId('custom-property-row-prop0');
    fireEvent.change(within(row).getByRole('textbox'), {
      target: { value },
    });
    fireEvent.click(within(row).getByTestId('inline-save-btn'));
  };

  it('edits a value inline in its row and removes a cleared one on save', async () => {
    const onUpdate = jest.fn().mockResolvedValue(true);

    renderSection(onUpdate);
    editInline('');

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        { extension: { prop1: 'E-1' } },
        'extension'
      )
    );
    await waitFor(() =>
      expect(screen.queryByTestId('inline-save-btn')).not.toBeInTheDocument()
    );
  });

  it('keeps the inline editor open when the save fails', async () => {
    const onUpdate = jest.fn().mockResolvedValue(false);

    renderSection(onUpdate);
    editInline('E-2');

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());

    expect(screen.getByTestId('inline-save-btn')).toBeInTheDocument();
  });

  it('leaves the row untouched on cancel', () => {
    const onUpdate = jest.fn();

    renderSection(onUpdate);
    fireEvent.click(screen.getByTestId('edit-prop0'));
    fireEvent.click(screen.getByTestId('inline-cancel-btn'));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByTestId('edit-prop0')).toBeInTheDocument();
  });

  it('hides "Manage fields" from non-admins, like its settings page', () => {
    renderSection();

    expect(
      screen.queryByTestId('manage-custom-properties')
    ).not.toBeInTheDocument();
  });

  it('opens the user custom properties settings from "Manage fields"', () => {
    mockIsAdmin = true;

    renderSection();
    fireEvent.click(screen.getByTestId('manage-custom-properties'));

    expect(mockSetHash).toHaveBeenCalledWith('custom-properties', 'user');
  });
});
