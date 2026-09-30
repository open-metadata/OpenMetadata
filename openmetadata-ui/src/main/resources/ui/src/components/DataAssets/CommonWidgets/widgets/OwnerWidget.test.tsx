/*
 *  Copyright 2025 Collate.
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
import { act, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { DetailPageWidgetKeys } from '../../../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { getOwnerVersionLabel } from '../../../../utils/EntityVersionUtils';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { OwnerWidget } from './OwnerWidget';

jest.mock('../../../Customization/GenericProvider/GenericContext');

jest.mock('@openmetadata/ui-core-components', () => ({
  Owner: () => <div data-testid="owner-list" />,
}));

jest.mock('../../../../utils/EntityVersionUtils', () => ({
  getOwnerVersionLabel: jest.fn(() => <div data-testid="owner-version-diff" />),
}));

jest.mock('../../../common/WidgetActionButton/WidgetActionButton', () => ({
  WidgetPlusButton: () => (
    <button aria-label="add owner" data-testid="add-owner" />
  ),
  WidgetEditButton: () => (
    <button aria-label="edit owner" data-testid="edit-owner" />
  ),
}));

jest.mock('../../../common/WidgetCard/WidgetCard', () => ({
  __esModule: true,
  default: ({
    children,
    headerExtra,
  }: {
    children: ReactNode;
    headerExtra: ReactNode;
  }) => (
    <div>
      {headerExtra}
      {children}
    </div>
  ),
}));

let mockSelectOwners: (owners: unknown[]) => Promise<void>;

jest.mock(
  '../../../common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: ({
      children,
      onUpdate,
    }: {
      children: ReactNode;
      onUpdate: (owners: unknown[]) => Promise<void>;
    }) => {
      mockSelectOwners = onUpdate;

      return <div data-testid="owner-selector">{children}</div>;
    },
  })
);

const mockOnUpdate = jest.fn();
const owner = { id: 'u1', type: 'user', name: 'aaron' };

const renderWidget = ({
  owners = [] as unknown[],
  permissions = { EditAll: true } as Record<string, boolean>,
  isVersionView = false,
} = {}) => {
  (useGenericContext as jest.Mock).mockReturnValue({
    data: { id: 'id-1', name: 'orders', owners },
    permissions,
    isVersionView,
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: false,
    },
    onUpdate: mockOnUpdate,
  });

  return render(
    <OwnerWidget
      showTaskHandler
      entityType={EntityType.TABLE}
      widgetConfig={{ i: DetailPageWidgetKeys.OWNERS, x: 0, y: 0, w: 1, h: 1 }}
    />
  );
};

describe('OwnerWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers to add owners when there are none and saves the selection', async () => {
    renderWidget();

    expect(await screen.findByTestId('add-owner')).toBeInTheDocument();

    await act(async () => {
      await mockSelectOwners([owner]);
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ owners: [owner] })
    );
  });

  it('offers to edit owners when owners exist', async () => {
    renderWidget({ owners: [owner] });

    expect(await screen.findByTestId('edit-owner')).toBeInTheDocument();
    expect(screen.getByTestId('owner-list')).toBeInTheDocument();
  });

  it('hides owner editing without edit permission', async () => {
    renderWidget({ permissions: { EditAll: false, EditOwners: false } });

    expect(await screen.findByTestId('owner-list')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-selector')).not.toBeInTheDocument();
  });

  it('shows the owner diff and no editing in version view', async () => {
    renderWidget({ owners: [owner], isVersionView: true });

    expect(await screen.findByTestId('owner-version-diff')).toBeInTheDocument();
    expect(getOwnerVersionLabel).toHaveBeenCalled();
    expect(screen.queryByTestId('owner-selector')).not.toBeInTheDocument();
  });
});
