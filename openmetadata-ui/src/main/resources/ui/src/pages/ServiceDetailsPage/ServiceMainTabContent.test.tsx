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
import { ComponentProps, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { UsePagingInterface } from '../../hooks/paging/usePaging';
import { ServicesType } from '../../interface/service.interface';
import { getServiceMainTabColumns } from '../../utils/ServiceMainTabContentUtils';
import {
  getEntityTypeFromServiceCategory,
  getSearchIndexForService,
} from '../../utils/ServicePureUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import ServiceMainTabContent from './ServiceMainTabContent';

// No prior test coverage for this file (Task 8 characterization-first rule). Scope is
// deliberately narrow: only the permission-flag wiring this batch touched, not the full
// table/pagination/search surface — those remain untested exactly as they were before this
// batch (out of scope).

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(),
}));

jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(),
}));

jest.mock('../../utils/ServicePureUtils', () => ({
  getCountLabel: jest.fn().mockReturnValue('Databases'),
  getEntityTypeFromServiceCategory: jest.fn(),
  getSearchIndexForService: jest.fn().mockReturnValue(undefined),
}));

jest.mock('../../utils/ServiceMainTabContentUtils', () => ({
  callServicePatchAPI: jest.fn(),
  getServiceMainTabColumns: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/TablePureUtils', () => ({
  getTagsWithoutTier: jest.fn().mockReturnValue([]),
  getTierTags: jest.fn().mockReturnValue(undefined),
}));

jest.mock('../../utils/TagsPureUtils', () => ({
  createTagObject: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/DatabaseSchemaDetailsUtils', () => ({
  buildSchemaQueryFilter: jest.fn().mockReturnValue({}),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        firstPanel,
        secondPanel,
      }: {
        firstPanel: { children: ReactNode };
        secondPanel: { children: ReactNode };
      }) => (
        <div data-testid="resizable-panels">
          <div>{firstPanel.children}</div>
          <div>{secondPanel.children}</div>
        </div>
      )
    )
);

jest.mock('../../components/common/Table/Table', () =>
  jest
    .fn()
    .mockImplementation(
      ({ extraTableFilters }: { extraTableFilters?: ReactNode }) => (
        <div data-testid="service-table">{extraTableFilters}</div>
      )
    )
);

jest.mock(
  '../../components/Customization/GenericProvider/GenericProvider',
  () => ({
    GenericProvider: ({ children }: { children: ReactNode }) => (
      <div data-testid="generic-provider">{children}</div>
    ),
  })
);

jest.mock('../../components/Entity/EntityRightPanel/EntityRightPanel', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        editDataProductPermission,
        editGlossaryTermsPermission,
        editTagPermission,
        viewCustomPropertiesPermission,
      }: {
        editDataProductPermission?: boolean;
        editGlossaryTermsPermission?: boolean;
        editTagPermission?: boolean;
        viewCustomPropertiesPermission?: boolean;
      }) => (
        <div data-testid="entity-right-panel">
          <span data-testid="edit-data-product">
            {String(Boolean(editDataProductPermission))}
          </span>
          <span data-testid="edit-glossary-terms">
            {String(Boolean(editGlossaryTermsPermission))}
          </span>
          <span data-testid="edit-tags">
            {String(Boolean(editTagPermission))}
          </span>
          <span data-testid="view-custom-properties">
            {String(Boolean(viewCustomPropertiesPermission))}
          </span>
        </div>
      )
    )
);

jest.mock('../../components/common/EntityDescription/Description', () =>
  jest
    .fn()
    .mockImplementation(({ hasEditAccess }: { hasEditAccess?: boolean }) => (
      <div data-testid="description">
        <span data-testid="has-edit-access">
          {String(Boolean(hasEditAccess))}
        </span>
      </div>
    ))
);

const mockServiceDetails = {
  id: 'service-id',
  name: 'test-service',
  fullyQualifiedName: 'test-service',
  deleted: false,
  tags: [],
} as unknown as ServicesType;

const mockPagingInfo: UsePagingInterface = {
  paging: { total: 0 },
  handlePagingChange: jest.fn(),
  currentPage: 1,
  handlePageChange: jest.fn(),
  pageSize: 10,
  handlePageSizeChange: jest.fn(),
  showPagination: false,
  pagingCursor: {},
};

const FULL_PERMISSION: OperationPermission = {
  ViewAll: true,
  ViewBasic: true,
  EditAll: true,
  EditTags: true,
  EditGlossaryTerms: true,
  EditDescription: true,
  ViewCustomFields: true,
} as OperationPermission;

const defaultProps = {
  serviceName: 'test-service',
  serviceDetails: mockServiceDetails,
  onDescriptionUpdate: jest.fn(),
  showDeleted: false,
  onShowDeletedChange: jest.fn(),
  data: [],
  isServiceLoading: false,
  paging: { total: 0 },
  currentPage: 1,
  setFilters: jest.fn(),
  saveUpdatedServiceData: jest.fn(),
  pagingInfo: mockPagingInfo,
  setIsServiceLoading: jest.fn(),
  onDataProductUpdate: jest.fn(),
};

const renderComponent = (
  props: Partial<ComponentProps<typeof ServiceMainTabContent>> & {
    servicePermission: OperationPermission;
  }
) =>
  render(
    <MemoryRouter>
      <ServiceMainTabContent {...defaultProps} {...props} />
    </MemoryRouter>
  );

describe('ServiceMainTabContent permission wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRequiredParams as jest.Mock).mockReturnValue({
      serviceCategory: 'databaseServices',
    });
    (usePermissionProvider as jest.Mock).mockReturnValue({
      permissions: {
        databaseService: FULL_PERMISSION,
      },
    });
    (getEntityTypeFromServiceCategory as jest.Mock).mockReturnValue(
      EntityType.DATABASE_SERVICE
    );
    (getSearchIndexForService as jest.Mock).mockReturnValue(undefined);
  });

  it('wires the description, tags, glossary-terms, data-product and custom-fields flags from servicePermission', () => {
    renderComponent({ servicePermission: FULL_PERMISSION });

    expect(screen.getByTestId('has-edit-access')).toHaveTextContent('true');
    expect(screen.getByTestId('edit-data-product')).toHaveTextContent('true');
    expect(screen.getByTestId('edit-glossary-terms')).toHaveTextContent('true');
    expect(screen.getByTestId('edit-tags')).toHaveTextContent('true');
    expect(screen.getByTestId('view-custom-properties')).toHaveTextContent(
      'true'
    );
  });

  it('denies description edit when EditDescription is explicitly false, even with EditAll true', () => {
    // Explicit-deny-wins: EditDescription/EditTags/EditGlossaryTerms use the prioritized
    // (field-key-wins-over-EditAll) derivation — this is a pure rename from the old
    // getPrioritizedEditPermission(...) calls, so it's already the OLD behavior too. This
    // test documents the (unchanged) prioritized semantics rather than a fix.
    renderComponent({
      servicePermission: {
        ...FULL_PERMISSION,
        EditDescription: false,
      },
    });

    expect(screen.getByTestId('has-edit-access')).toHaveTextContent('false');
  });

  it('denies every edit flag when the service is deleted', () => {
    renderComponent({
      serviceDetails: { ...mockServiceDetails, deleted: true },
      servicePermission: FULL_PERMISSION,
    });

    expect(screen.getByTestId('has-edit-access')).toHaveTextContent('false');
    expect(screen.getByTestId('edit-data-product')).toHaveTextContent('false');
    expect(screen.getByTestId('edit-glossary-terms')).toHaveTextContent(
      'false'
    );
    expect(screen.getByTestId('edit-tags')).toHaveTextContent('false');
    // View flags are never deleted-gated.
    expect(screen.getByTestId('view-custom-properties')).toHaveTextContent(
      'true'
    );
  });

  it('shows the bulk-edit-table button for a database service when EditAll is true and not deleted', () => {
    renderComponent({ servicePermission: FULL_PERMISSION });

    expect(screen.getByTestId('bulk-edit-table')).toBeInTheDocument();
  });

  it('hides the bulk-edit-table button when the service is deleted', () => {
    renderComponent({
      serviceDetails: { ...mockServiceDetails, deleted: true },
      servicePermission: FULL_PERMISSION,
    });

    expect(screen.queryByTestId('bulk-edit-table')).not.toBeInTheDocument();
  });

  it('passes the resource-level editDisplayNamePermission (EditAll || EditDisplayName) through to getServiceMainTabColumns', () => {
    renderComponent({ servicePermission: FULL_PERMISSION });

    expect(getServiceMainTabColumns).toHaveBeenCalledWith(
      'databaseServices',
      true,
      expect.any(Function),
      undefined
    );
  });

  it('denies editDisplayNamePermission when EditDisplayName is explicitly false, even with EditAll true', () => {
    // Explicit-deny-wins fix (Task 6 Finding 1): the old raw `EditAll || EditDisplayName` OR
    // granted regardless of an explicit EditDisplayName:false — getDerivedPermissionFlags'
    // canEditDisplayName correctly denies here.
    (usePermissionProvider as jest.Mock).mockReturnValue({
      permissions: {
        databaseService: {
          ...FULL_PERMISSION,
          EditDisplayName: false,
        },
      },
    });

    renderComponent({ servicePermission: FULL_PERMISSION });

    expect(getServiceMainTabColumns).toHaveBeenCalledWith(
      'databaseServices',
      false,
      expect.any(Function),
      undefined
    );
  });
});
