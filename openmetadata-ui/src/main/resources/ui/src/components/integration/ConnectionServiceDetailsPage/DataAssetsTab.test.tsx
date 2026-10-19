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
import { render, screen, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../../enums/entity.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { ServicesType } from '../../../interface/service.interface';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import Description from '../../common/EntityDescription/Description';
import DataAssetsTab from './DataAssetsTab';

const mockServiceMainTabContent = jest.fn();
jest.mock(
  '../../../pages/ServiceDetailsPage/ServiceMainTabContent',
  () => (props: Record<string, unknown>) => {
    mockServiceMainTabContent(props);

    return <div data-testid="service-main-tab-content" />;
  }
);

jest.mock('../../common/EntityDescription/Description', () =>
  jest.fn(() => <div data-testid="description" />)
);

const mockGenericProvider = jest.fn();
jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: ({
    children,
    ...props
  }: {
    children: ReactNode;
    [key: string]: unknown;
  }) => {
    mockGenericProvider(props);

    return <>{children}</>;
  },
}));

jest.mock('../../DataAssets/CommonWidgets/CommonWidgets', () => ({
  CommonWidgets: ({
    widgetConfig,
    entityType,
  }: {
    widgetConfig: { i: string };
    entityType: string;
  }) => (
    <div
      data-entity-type={entityType}
      data-testid={`widget-${widgetConfig.i}`}
    />
  ),
}));

const EDIT_ALL = {
  ...DEFAULT_ENTITY_PERMISSION,
  EditAll: true,
  EditDescription: true,
  ViewAll: true,
} as OperationPermission;

const saveUpdatedServiceData = jest.fn();
const onDescriptionUpdate = jest.fn();

const SERVICE = {
  id: 'svc-1',
  name: 'svc',
  description: 'About svc',
} as unknown as ServicesType;

const renderTab = ({
  permission = EDIT_ALL,
  deleted = false,
}: {
  permission?: OperationPermission;
  deleted?: boolean;
} = {}) =>
  render(
    <DataAssetsTab
      currentPage={1}
      data={[]}
      isServiceLoading={false}
      paging={{ total: 0 }}
      pagingInfo={{} as never}
      saveUpdatedServiceData={saveUpdatedServiceData}
      serviceCategory={ServiceCategory.DATABASE_SERVICES}
      serviceDetails={{ ...SERVICE, deleted }}
      servicePermission={permission}
      setFilters={jest.fn()}
      setIsServiceLoading={jest.fn()}
      showDeleted={false}
      onDataProductUpdate={jest.fn()}
      onDescriptionUpdate={onDescriptionUpdate}
      onShowDeletedChange={jest.fn()}
    />
  );

const lastDescriptionProps = () =>
  (Description as unknown as jest.Mock).mock.calls.at(-1)?.[0];

describe('DataAssetsTab — layout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the service description as a card above the asset list', () => {
    renderTab();

    expect(lastDescriptionProps()).toEqual(
      expect.objectContaining({
        wrapInCard: true,
        description: 'About svc',
        entityType: EntityType.DATABASE_SERVICE,
        hasEditAccess: true,
        onDescriptionUpdate,
      })
    );
  });

  it('keeps the description read-only on a soft-deleted service', () => {
    renderTab({ deleted: true });

    expect(lastDescriptionProps()).toEqual(
      expect.objectContaining({ hasEditAccess: false, showActions: false })
    );
  });

  // Same cards, in the same order, as an entity page's right panel.
  it('shows data products, tags and glossary terms in the right panel', () => {
    renderTab();

    const panel = screen.getByTestId('service-right-panel');
    const widgets = within(panel).getAllByTestId(/^widget-/);

    expect(widgets.map((w) => w.dataset.testid)).toEqual([
      `widget-${DetailPageWidgetKeys.DATA_PRODUCTS}`,
      `widget-${DetailPageWidgetKeys.TAGS}`,
      `widget-${DetailPageWidgetKeys.GLOSSARY_TERMS}`,
    ]);

    widgets.forEach((w) =>
      expect(w).toHaveAttribute('data-entity-type', EntityType.DATABASE_SERVICE)
    );
  });

  // The widgets read the service and save it through the page's own patch.
  it('backs the right panel with the service and its save', () => {
    renderTab();

    expect(mockGenericProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: 'svc-1' }),
        permissions: EDIT_ALL,
        type: EntityType.DATABASE_SERVICE,
        onUpdate: saveUpdatedServiceData,
      })
    );
  });

  // The tab already sits in the page's frame, and renders its own right panel: a card around the
  // table would be a box in a box, and a second right panel a duplicate fetch.
  it('shows the asset table without a card or right panel of its own', () => {
    renderTab();

    expect(mockServiceMainTabContent).toHaveBeenCalledWith(
      expect.objectContaining({ wrapInCard: false, hideRightPanel: true })
    );
  });

  // data-assets-tab.less stops the classic tab body sizing itself off the viewport (dead space
  // below a short table) and hides its own description and right panel through these wrappers.
  // jsdom applies no stylesheet, so this pins the hook the rules hang on.
  it('nests the asset list in the wrappers its stylesheet targets', () => {
    renderTab();

    const list = screen.getByTestId('service-main-tab-content');

    expect(list.parentElement).toHaveClass('data-assets-table-wrapper');
    expect(list.closest('.data-assets-tab')).not.toBeNull();
  });
});
