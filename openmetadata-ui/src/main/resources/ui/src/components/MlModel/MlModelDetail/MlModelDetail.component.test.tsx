/*
 *  Copyright 2022 Collate.
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
  findAllByText,
  findByTestId,
  findByText,
  render,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs } from '../../../enums/entity.enum';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Paging } from '../../../generated/type/paging';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { showErrorToast } from '../../../utils/ToastUtils';
import MlModelDetailComponent from './MlModelDetail.component';

// The component now reads permissions via useEntityPermissions rather than the raw
// PermissionProvider context — see TableDetailsPageV1.test.tsx's setMockPermissions for the
// full rationale (partial-object fidelity, mockReturnValue over mockImplementationOnce, the
// `deleted`-gating blind spot), mirrored here without repeating it.
const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (
  overrides: Partial<OperationPermission> = {},
  {
    isLoading = false,
    error = null as unknown,
  }: { isLoading?: boolean; error?: unknown } = {}
) => {
  const permissions = overrides as OperationPermission;
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading,
    error,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, false),
  });
};

jest.mock('../../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

const mockData = {
  id: '1b561c2d-f449-4640-b893-94077cf1c35b',
  name: 'eta_predictions',
  fullyQualifiedName: 'mlflow_svc.eta_predictions',
  displayName: 'ETA Predictions',
  description: 'ETA Predictions Model',
  algorithm: 'Neural Network',
  mlFeatures: [
    {
      name: 'sales',
      dataType: 'numerical',
      description: 'Sales amount',
      fullyQualifiedName: 'mlflow_svc.eta_predictions.sales',
      featureSources: [
        {
          name: 'gross_sales',
          dataType: 'integer',
          fullyQualifiedName: 'null.gross_sales',
          dataSource: {
            id: '1cad4f03-b4a9-4d26-b01e-1a2a17166a07',
            type: 'table',
            name: 'sample_data.ecommerce_db.shopify.fact_sale',
            description: '',
            href: 'http://localhost:8585/api/v1/tables/1cad4f03-b4a9-4d26-b01e-1a2a17166a07',
          },
        },
      ],
    },
    {
      name: 'persona',
      dataType: 'categorical',
      description: 'type of buyer',
      fullyQualifiedName: 'mlflow_svc.eta_predictions.persona',
      featureSources: [
        {
          name: 'membership',
          dataType: 'string',
          fullyQualifiedName: 'null.membership',
          dataSource: {
            id: '534a2b21-24e6-4bd3-970e-d0944f66faee',
            type: 'table',
            name: 'sample_data.ecommerce_db.shopify.raw_customer',
            description: '',
            href: 'http://localhost:8585/api/v1/tables/534a2b21-24e6-4bd3-970e-d0944f66faee',
          },
        },
        {
          name: 'platform',
          dataType: 'string',
          fullyQualifiedName: 'null.platform',
          dataSource: {
            id: '534a2b21-24e6-4bd3-970e-d0944f66faee',
            type: 'table',
            name: 'sample_data.ecommerce_db.shopify.raw_customer',
            description: '',
            href: 'http://localhost:8585/api/v1/tables/534a2b21-24e6-4bd3-970e-d0944f66faee',
          },
        },
      ],
      featureAlgorithm: 'PCA',
    },
  ],
  mlHyperParameters: [
    {
      name: 'regularisation',
      value: '0.5',
    },
    {
      name: 'random',
      value: 'hello',
    },
  ],
  target: 'ETA_time',
  dashboard: {
    id: '2323c1b1-1b0a-446a-946c-693339f49d71',
    type: 'dashboard',
    name: 'eta_predictions_performance',
    fullyQualifiedName: 'sample_superset.eta_predictions_performance',
    description: '',
    displayName: 'ETA Predictions Performance',
    deleted: false,
    href: 'http://localhost:8585/api/v1/dashboards/2323c1b1-1b0a-446a-946c-693339f49d71',
  },
  mlStore: {
    storage: 's3://path-to-pickle',
    imageRepository: 'https://docker.hub.com/image',
  },
  server: 'http://my-server.ai',
  href: 'http://localhost:8585/api/v1/mlmodels/1b561c2d-f449-4640-b893-94077cf1c35b',
  followers: [],
  tags: [],
  version: 0.1,
  updatedAt: 1655795270330,
  updatedBy: 'anonymous',
  service: {
    id: '5a8ab96f-3508-4f7f-95a4-8919d509321c',
    type: 'mlmodelService',
    name: 'mlflow_svc',
    fullyQualifiedName: 'mlflow_svc',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/mlmodelServices/5a8ab96f-3508-4f7f-95a4-8919d509321c',
  },
  serviceType: 'Mlflow',
  deleted: false,
};

const followMlModelHandler = jest.fn();
const unFollowMlModelHandler = jest.fn();
const descriptionUpdateHandler = jest.fn();
const setActiveTabHandler = jest.fn();
const tagUpdateHandler = jest.fn();
const updateMlModelFeatures = jest.fn();
const settingsUpdateHandler = jest.fn();

const mockProp = {
  mlModelDetail: mockData as Mlmodel,
  activeTab: 1,
  fetchMlModel: jest.fn(),
  followMlModelHandler,
  unFollowMlModelHandler,
  descriptionUpdateHandler,
  setActiveTabHandler,
  tagUpdateHandler,
  updateMlModelFeatures,
  settingsUpdateHandler,
  lineageTabData: {
    loadNodeHandler: jest.fn(),
    addLineageHandler: jest.fn(),
    removeLineageHandler: jest.fn(),
    entityLineageHandler: jest.fn(),
    isLineageLoading: false,
    entityLineage: { entity: { id: 'test', type: 'mlmodel' } },
    isNodeLoading: { id: undefined, state: false },
  },
  onExtensionUpdate: jest.fn(),
  entityThread: [],
  isEntityThreadLoading: false,
  paging: {} as Paging,
  feedCount: 2,
  fetchFeedHandler: jest.fn(),
  postFeedHandler: jest.fn(),
  deletePostHandler: jest.fn(),
  onMlModelUpdate: jest.fn(),
  updateThreadHandler: jest.fn(),
  entityFieldThreadCount: [],
  entityFieldTaskCount: [],
  createThread: jest.fn(),
  version: '0.1',
  versionHandler: jest.fn(),
  handleToggleDelete: jest.fn(),
  onUpdateVote: jest.fn(),
  onMlModelUpdateCertification: jest.fn(),
};

const mockParams = {
  mlModelFqn: 'test',
  tab: EntityTabs.FEATURES,
};

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ pathname: 'mlmodel' }));
});

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockImplementation(() => mockParams),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({
    fqn: 'mlflow_svc.eta_predictions',
    entityFqn: 'mlflow_svc.eta_predictions',
  }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { id: 'testUser' },
  }),
}));

jest.mock('../../../hooks/useCustomPages', () => ({
  useCustomPages: jest.fn().mockReturnValue({
    customizedPage: undefined,
    isLoading: false,
  }),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermission: jest.fn().mockResolvedValue({
      ViewAll: true,
      ViewBasic: true,
    }),
  })),
}));

jest.mock('../../../utils/FeedUtilsPure', () => ({
  fetchEntityActivityCountInto: jest.fn(),
  fetchEntityTaskCountsInto: jest.fn(),
  getFeedCounts: jest.fn(),
}));

jest.mock('../../AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((component) => component),
}));

jest.mock('../../../hoc/LimitWrapper', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock(
  '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest.fn().mockReturnValue(<div>DataAssetsHeader</div>),
  })
);

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../../Customization/GenericTab/GenericTab', () => ({
  GenericTab: jest.fn().mockReturnValue(<div>GenericTab</div>),
}));

jest.mock('../../Lineage/EntityLineageTab/EntityLineageTab', () => ({
  EntityLineageTab: jest.fn().mockReturnValue(<div>EntityLineageTab</div>),
}));

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest.fn().mockReturnValue(<div>ErrorPlaceHolder</div>);
});

jest.mock('../../common/TabsLabel/TabsLabel.component', () => {
  return jest.fn().mockImplementation(({ name }) => <p>{name}</p>);
});

jest.mock('../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('entityName'),
}));

jest.mock('../../../utils/TablePureUtils', () => {
  return {
    getTagsWithoutTier: jest.fn().mockReturnValue([]),
    getTierTags: jest.fn().mockReturnValue(undefined),
  };
});

jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockReturnValue(<p>CustomPropertyTable.component</p>),
}));

// --- Additional mocks for the permission-conversion tests below, on top of the shared
// mocks above. `useFqn`, `useCustomPages`, `useApplicationStore`, `useRequiredParams`,
// `DataAssetsHeader`, `GenericProvider`, `LimitWrapper` and `FeedUtilsPure` are already
// mocked above and reused as-is — re-registering them here would silently win (last
// `jest.mock` call for a given path wins) and diverge from the suite below. In particular,
// `useRequiredParams` must stay the dynamic `mockParams`-backed mock above: the suite below
// mutates `mockParams.tab` per test to switch tabs, and `MlModelClassBase` is deliberately
// left unmocked so the real tab list renders for both suites — a static override here would
// break every tab-switching assertion below.
jest.mock('../../../rest/mlModelAPI', () => ({
  restoreMlmodel: jest.fn().mockResolvedValue({ version: 1 }),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest.fn().mockReturnValue('/mlmodel/path'),
}));

describe('MlModelDetail permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockPermissions(ENTITY_PERMISSIONS);
  });

  // Guardrail: this component owns the single useEntityPermissions call whose raw
  // `mlModelPermissions` prop feeds DataAssetsHeader/GenericProvider — see
  // PipelineDetails.test.tsx's afterEach for the general rationale on asserting the
  // (resource, identifier) pair. Only one call per render here, so this is mostly
  // future-proofing against a later edit accidentally adding a diverging second call.
  afterEach(() => {
    const calls = mockUseEntityPermissions.mock.calls;
    if (calls.length === 0) {
      return;
    }
    const [expectedResource, expectedIdentifier] = calls[0];
    calls.forEach(([resource, identifier]) => {
      expect(resource).toBe(expectedResource);
      expect(identifier).toBe(expectedIdentifier);
    });
  });

  it('should fetch permissions by id, not fqn', async () => {
    render(<MlModelDetailComponent {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    await waitFor(() => {
      expect(mockUseEntityPermissions).toHaveBeenCalledWith(
        ResourceEntity.ML_MODEL,
        { id: mockData.id },
        { deleted: false }
      );
    });
  });

  it('requests edit permissions as deleted-gated for a soft-deleted mlmodel', async () => {
    render(
      <MlModelDetailComponent
        {...mockProp}
        mlModelDetail={{ ...mockData, deleted: true } as Mlmodel}
      />,
      { wrapper: MemoryRouter }
    );

    await waitFor(() => {
      expect(mockUseEntityPermissions).toHaveBeenCalledWith(
        ResourceEntity.ML_MODEL,
        { id: mockData.id },
        { deleted: true }
      );
    });
  });

  it('shows the permission-fetch error toast when the hook reports an error', async () => {
    setMockPermissions(ENTITY_PERMISSIONS, {
      error: new Error('permission fetch failed'),
    });

    render(<MlModelDetailComponent {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    // t() is globally mocked to the identity function (see src/setupTests.js), so the
    // interpolated `entity` option collapses out and only the outer key survives.
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(
        'server.fetch-entity-permissions-error'
      );
    });
  });
});

describe('Test MlModel entity detail component', () => {
  it('Should render detail component', async () => {
    mockParams.tab = EntityTabs.FEATURES;
    const { container } = render(<MlModelDetailComponent {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const dataAssetsHeader = await findByText(container, 'DataAssetsHeader');
    const entityTabs = await findByTestId(container, 'tabs');
    const featuresTab = await findByText(container, 'GenericTab');

    expect(dataAssetsHeader).toBeInTheDocument();
    expect(entityTabs).toBeInTheDocument();
    expect(featuresTab).toBeInTheDocument();
  });

  it('Should render hyper parameter and ml store table for details tab', async () => {
    const mockPropDetails = {
      ...mockProp,
      mlModelDetail: {
        ...mockProp.mlModelDetail,
        mlHyperParameters: [],
        mlStore: undefined,
      },
    };
    mockParams.tab = EntityTabs.DETAILS;
    const { container } = render(
      <MlModelDetailComponent {...mockPropDetails} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const entityTabs = await findByTestId(container, 'tabs');
    const emptyTablePlaceholder = await findAllByText(
      container,
      'ErrorPlaceHolder'
    );

    expect(entityTabs).toBeInTheDocument();
    expect(emptyTablePlaceholder).toHaveLength(2);
  });

  it('Should render no data placeholder hyper parameter and ml store details tab', async () => {
    mockParams.tab = EntityTabs.DETAILS;
    const { container } = render(<MlModelDetailComponent {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const hyperMetereTable = await findByTestId(
      container,
      'hyperparameters-table'
    );

    const mlStoreTable = await findByTestId(container, 'model-store-table');

    expect(hyperMetereTable).toBeInTheDocument();
    expect(mlStoreTable).toBeInTheDocument();
  });

  it('Should render lineage tab', async () => {
    mockParams.tab = EntityTabs.LINEAGE;
    const { container } = render(<MlModelDetailComponent {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const lineageTab = await findByText(container, 'EntityLineageTab');

    expect(lineageTab).toBeInTheDocument();
  });

  it('Check if active tab is custom properties', async () => {
    mockParams.tab = EntityTabs.CUSTOM_PROPERTIES;
    const { container } = render(<MlModelDetailComponent {...mockProp} />, {
      wrapper: MemoryRouter,
    });
    const customProperties = await findByText(
      container,
      'CustomPropertyTable.component'
    );

    expect(customProperties).toBeInTheDocument();
  });

  it('Soft deleted mlmodel should be visible', async () => {
    mockParams.tab = EntityTabs.FEATURES;
    const { container } = render(
      <MlModelDetailComponent
        {...mockProp}
        mlModelDetail={{ ...mockData, deleted: true } as Mlmodel}
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const dataAssetsHeader = await findByText(container, 'DataAssetsHeader');
    const entityTabs = await findByTestId(container, 'tabs');
    const featuresTab = await findByText(container, 'GenericTab');

    expect(dataAssetsHeader).toBeInTheDocument();
    expect(entityTabs).toBeInTheDocument();
    expect(featuresTab).toBeInTheDocument();
  });
});
