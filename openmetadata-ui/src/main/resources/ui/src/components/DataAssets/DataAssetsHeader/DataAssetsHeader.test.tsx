/*
 *  Copyright 2023 Collate.
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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AUTO_PILOT_APP_NAME } from '../../../constants/Applications.constant';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import {
  Container,
  StorageServiceType,
} from '../../../generated/entity/data/container';
import { ContractExecutionStatus } from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import { DatabaseServiceType } from '../../../generated/entity/services/databaseService';
import { LabelType, State, TagSource } from '../../../generated/tests/testCase';
import { AssetCertification } from '../../../generated/type/assetCertification';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { MOCK_DATA_CONTRACT } from '../../../mocks/DataContract.mock';
import { MOCK_TIER_DATA } from '../../../mocks/TableData.mock';
import { triggerOnDemandApp } from '../../../rest/applicationAPI';
import { getContractByEntityId } from '../../../rest/contractAPI';
import { getDataQualityLineage } from '../../../rest/lineageAPI';
import { getContainerAncestors } from '../../../rest/storageAPI';
import { listDataAccessRequests } from '../../../rest/tasksAPI';
import { ExtraInfoLink } from '../../../utils/DataAssetsHeader.utils';
import { getDataContractStatusIcon } from '../../../utils/DataContract/DataContractUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { DataAssetsHeader } from './DataAssetsHeader.component';
import { DataAssetsHeaderProps } from './DataAssetsHeader.interface';

const mockProps: DataAssetsHeaderProps = {
  dataAsset: {
    id: 'assets-id',
    name: 'testContainer',
    fullyQualifiedName: 'fullyQualifiedName',
    parent: {
      id: 'id',
      type: 'container',
      fullyQualifiedName: 'fullyQualifiedName',
    },
    service: {
      id: 'service-id',
      name: 's3_storage_sample',
      type: 'storageService',
    },
    serviceType: 'moc service' as StorageServiceType,
  } as Container,
  entityType: EntityType.CONTAINER,
  permissions: DEFAULT_ENTITY_PERMISSION,
  onRestoreDataAsset: jest.fn(),
  onDisplayNameUpdate: jest.fn(),
  onFollowClick: jest.fn(),
  onVersionClick: jest.fn(),
  onTierUpdate: jest.fn(),
  onOwnerUpdate: jest.fn(),
};

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockReturnValue({
    serviceCategory: undefined,
  }),
}));

jest.mock('../../../rest/applicationAPI', () => ({
  triggerOnDemandApp: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../utils/ServiceUtils', () => ({
  getEntityTypeFromServiceCategory: jest
    .fn()
    .mockImplementation(() => EntityType.DATABASE_SERVICE),
}));

jest.mock('../../../rest/contractAPI', () => ({
  getContractByEntityId: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockImplementation(() => 'name'),
}));

jest.mock('../../../utils/EntityPureUtils', () => ({
  getEntityFeedLink: jest.fn().mockImplementation(() => 'entityFeedLink'),
}));

jest.mock('../../../utils/EntityVoteUtils', () => ({
  getEntityVoteStatus: jest.fn().mockImplementation(() => 'unVoted'),
}));

jest.mock('../../../utils/DataAssetsHeader.utils', () => ({
  getDataAssetsHeaderInfo: jest.fn().mockImplementation(() => ({
    breadcrumbs: [],
    extraInfo: [],
  })),
  getEntityExtraInfoLength: jest.fn().mockImplementation(() => 0),
  isDataAssetsWithServiceField: jest.fn().mockImplementation(() => true),
  HeaderDotSeparator: jest
    .fn()
    .mockImplementation(() => <span data-testid="header-dot-separator" />),
  ExtraInfoLabel: jest
    .fn()
    .mockImplementation(({ label, value, dataTestId }) => (
      <div data-testid={dataTestId}>
        {label && <span>{label}</span>}
        <div>{value}</div>
      </div>
    )),
  ExtraInfoLink: jest.fn().mockImplementation(({ value, href, newTab }) => {
    const props = {
      href,
      ...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
    };

    return <a {...props}>{value}</a>;
  }),
}));

jest.mock('../../common/CertificationTag/CertificationTag', () => {
  return jest.fn().mockImplementation(() => <div>CertificationTag</div>);
});

jest.mock('../../common/HeaderBreadcrumb/HeaderBreadcrumb.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="breadcrumb">HeaderBreadcrumb.component</div>
    ))
);
jest.mock(
  '../../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>EntityHeaderTitle.component</div>);
  }
);
jest.mock('../../../components/common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest
    .fn()
    .mockImplementation(() => <div>OwnerLabel.component</div>),
}));
jest.mock('../../../components/common/TierCard/TierCard', () =>
  jest.fn().mockImplementation(({ children }) => (
    <div>
      TierCard.component
      <div>{children}</div>
    </div>
  ))
);
jest.mock(
  '../../../components/common/EntityPageInfos/ManageButton/ManageButton',
  () => jest.fn().mockImplementation(() => <div>ManageButton.component</div>)
);
jest.mock(
  '../../../components/common/AnnouncementsWidget/AnnouncementsWidgetV3Body.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => <div>AnnouncementsWidgetV3Body.component</div>)
);
jest.mock(
  '../../../components/common/EntityPageInfos/AnnouncementDrawer/AnnouncementDrawer',
  () =>
    jest.fn().mockImplementation(() => <div>AnnouncementDrawer.component</div>)
);

jest.mock('../../Tag/TagsV1/TagsV1.component', () =>
  jest.fn().mockImplementation(() => <div>TagsV1.component</div>)
);

jest.mock('../../../rest/storageAPI', () => ({
  getContainerAncestors: jest
    .fn()
    .mockImplementation(() => Promise.resolve([])),
}));

let mockIsAlertSupported = false;
jest.mock('../../../utils/TableClassBase', () => ({
  getAlertEnableStatus: jest
    .fn()
    .mockImplementation(() => mockIsAlertSupported),
  getShowRequestDataAccess: jest.fn().mockImplementation(() => false),
  getRequestDataAccessDrawer: jest.fn().mockImplementation(() => null),
}));

jest.mock('../../../rest/tasksAPI', () => ({
  ...jest.requireActual('../../../rest/tasksAPI'),
  listDataAccessRequests: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../../utils/TasksUtils', () =>
  jest.requireActual('../../../utils/TasksUtils')
);

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { id: 'user-1', name: 'test.user' },
  }),
}));

jest.mock('../../../rest/lineageAPI', () => ({
  getDataQualityLineage: jest.fn(),
}));

jest.mock('../../../utils/DataContract/DataContractUtils', () => ({
  getDataContractStatusIcon: jest.fn(),
}));

jest.mock('../../../hooks/useCustomPages', () => ({
  useCustomPages: jest.fn().mockReturnValue({ customizedPage: null }),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest.fn(),
}));

jest.mock(
  '../../../context/RuleEnforcementProvider/RuleEnforcementProvider',
  () => ({
    useRuleEnforcementProvider: jest.fn().mockImplementation(() => ({
      fetchRulesForEntity: jest.fn(),
      getRulesForEntity: jest.fn(),
      getEntityRuleValidation: jest.fn(),
    })),
  })
);

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockImplementation(() => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  })),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: jest.fn().mockResolvedValue({}),
    permissions: { task: { Create: true, Delete: false, EditAll: false } },
  })),
}));

describe('ExtraInfoLink component', () => {
  const mockProps = {
    label: 'myLabel',
    value: 'example',
    href: 'http://example.com/',
  };

  it('should not have target and rel attributes when newTab is false (default)', () => {
    const { container } = render(<ExtraInfoLink {...mockProps} />);

    const elm = container.querySelector('a');

    expect(elm).toHaveAttribute('href', mockProps.href);
    expect(elm).not.toHaveAttribute('target');
    expect(elm).not.toHaveAttribute('rel');
  });

  it('should have target and rel attributes when newTab is true', () => {
    const { container } = render(<ExtraInfoLink {...mockProps} newTab />);

    const elm = container.querySelector('a');

    expect(elm).toHaveAttribute('href', mockProps.href);
    expect(elm).toHaveAttribute('target', '_blank');

    const rel = (elm?.getAttribute('rel') || '').split(/\s+/g);

    expect(rel.sort()).toStrictEqual(['noopener', 'noreferrer'].sort());
  });
});

describe('DataAssetsHeader component', () => {
  it('should call getContainerAncestors API on Page load for container assets', () => {
    const mockGetContainerAncestors = getContainerAncestors as jest.Mock;
    render(<DataAssetsHeader {...mockProps} />);

    // The breadcrumb resolution is now a single batched server call against
    // the container's own FQN. The server returns the full ancestor chain.
    expect(mockGetContainerAncestors).toHaveBeenCalledWith(
      mockProps.dataAsset.fullyQualifiedName
    );
    expect(getDataQualityLineage).not.toHaveBeenCalled();
  });

  it('should not call getContainerAncestors API when the container FQN is missing', () => {
    const mockGetContainerAncestors = getContainerAncestors as jest.Mock;
    mockGetContainerAncestors.mockClear();
    render(
      <DataAssetsHeader
        {...mockProps}
        dataAsset={{ ...mockProps.dataAsset, fullyQualifiedName: '' }}
      />
    );

    expect(mockGetContainerAncestors).not.toHaveBeenCalled();
  });

  it('should resolve the full ancestor chain in a single API call', async () => {
    // Replaces the old recursive behaviour where each ancestor required its
    // own getContainerByName request. We assert the breadcrumb resolution
    // makes exactly one network call regardless of nesting depth.
    const mockGetContainerAncestors = getContainerAncestors as jest.Mock;
    mockGetContainerAncestors.mockClear();
    mockGetContainerAncestors.mockResolvedValue([
      {
        id: 'root-id',
        type: 'container',
        name: 'root',
        displayName: 'Root',
        fullyQualifiedName: 's3.root',
      },
      {
        id: 'mid-id',
        type: 'container',
        name: 'mid',
        displayName: 'Mid',
        fullyQualifiedName: 's3.root.mid',
      },
      {
        id: 'leaf-parent-id',
        type: 'container',
        name: 'leaf_parent',
        displayName: 'Leaf Parent',
        fullyQualifiedName: 's3.root.mid.leaf_parent',
      },
    ]);

    await act(async () => {
      render(
        <DataAssetsHeader
          {...mockProps}
          dataAsset={{
            ...mockProps.dataAsset,
            fullyQualifiedName: 's3.root.mid.leaf_parent.leaf',
          }}
        />
      );
    });

    expect(mockGetContainerAncestors).toHaveBeenCalledTimes(1);
    expect(mockGetContainerAncestors).toHaveBeenCalledWith(
      's3.root.mid.leaf_parent.leaf'
    );
  });

  it('should render the Tier data if present', () => {
    render(
      <DataAssetsHeader
        {...mockProps}
        dataAsset={{
          ...mockProps.dataAsset,
          tags: [MOCK_TIER_DATA],
        }}
      />
    );

    expect(screen.getByText('TagsV1.component')).toBeInTheDocument();
  });

  it('should not render the Tier data if not  present', () => {
    render(<DataAssetsHeader {...mockProps} dataAsset={mockProps.dataAsset} />);

    expect(screen.getByTestId('Tier')).toContainHTML('--');
  });

  it('should not call getDataQualityLineage, if isDqAlertSupported and alert supported is false', () => {
    act(() => {
      render(<DataAssetsHeader {...mockProps} />);
    });

    expect(getDataQualityLineage).not.toHaveBeenCalled();
  });

  it('should not call getDataQualityLineage, if isDqAlertSupported is false & alert supported is true', () => {
    mockIsAlertSupported = true;
    act(() => {
      render(<DataAssetsHeader {...mockProps} />);
    });

    expect(getDataQualityLineage).not.toHaveBeenCalled();

    mockIsAlertSupported = false;
  });

  it('should not call getDataQualityLineage, if isDqAlertSupported is true & alert supported is false', () => {
    act(() => {
      render(<DataAssetsHeader isDqAlertSupported {...mockProps} />);
    });

    expect(getDataQualityLineage).not.toHaveBeenCalled();
  });

  it('should call getDataQualityLineage, if isDqAlertSupported and alert supported is true', () => {
    mockIsAlertSupported = true;
    act(() => {
      render(<DataAssetsHeader isDqAlertSupported {...mockProps} />);
    });

    expect(getDataQualityLineage).toHaveBeenCalledWith('fullyQualifiedName', {
      upstreamDepth: 1,
    });

    mockIsAlertSupported = false;
  });

  it('should render source URL button when sourceUrl is present', () => {
    const mockSourceUrl = 'http://test-source.com';

    render(
      <DataAssetsHeader
        {...mockProps}
        dataAsset={{
          ...mockProps.dataAsset,
          sourceUrl: mockSourceUrl,
        }}
      />
    );

    const sourceUrlButton = screen.getByTestId('source-url-button');

    const sourceUrlLink = screen.getByRole('link');

    expect(sourceUrlButton).toBeInTheDocument();
    expect(sourceUrlLink).toHaveAttribute('href', mockSourceUrl);
    expect(sourceUrlLink).toHaveAttribute('target', '_blank');
    expect(screen.getByText('label.view-in-service-type')).toBeInTheDocument();
  });

  it('should not render source URL button when sourceUrl is not present', () => {
    render(<DataAssetsHeader {...mockProps} />);

    expect(screen.queryByTestId('source-url-button')).not.toBeInTheDocument();
  });

  it('should render source URL button from endpointURL for API entities', () => {
    const mockEndpointUrl = 'https://petstore3.swagger.io/#/pet';
    const apiEndpointProps = {
      ...mockProps,
      dataAsset: {
        ...mockProps.dataAsset,
        sourceUrl: undefined,
        endpointURL: mockEndpointUrl,
      },
    } as DataAssetsHeaderProps;

    render(<DataAssetsHeader {...apiEndpointProps} />);

    const sourceUrlButton = screen.getByTestId('source-url-button');

    expect(sourceUrlButton).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', mockEndpointUrl);
  });

  it('should render the follow button in the stat bar and trigger onFollowClick', () => {
    const onFollowClick = jest.fn();

    render(<DataAssetsHeader {...mockProps} onFollowClick={onFollowClick} />);

    const followButton = screen.getByTestId('entity-follow-button');

    expect(followButton).toBeInTheDocument();
    expect(followButton).toHaveTextContent('label.follow');

    fireEvent.click(followButton);

    expect(onFollowClick).toHaveBeenCalled();
  });

  it('should disable the up-vote button while the vote request is in flight', async () => {
    let resolveVote: () => void = () => undefined;
    const onUpdateVote = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveVote = resolve;
        })
    );

    render(<DataAssetsHeader {...mockProps} onUpdateVote={onUpdateVote} />);

    const upVoteButton = screen.getByTestId('up-vote-btn');

    fireEvent.click(upVoteButton);

    await waitFor(() => expect(upVoteButton).toBeDisabled());

    fireEvent.click(upVoteButton);

    expect(onUpdateVote).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveVote();
    });
  });

  it('should disable the follow button while the follow request is in flight', async () => {
    let resolveFollow: () => void = () => undefined;
    const onFollowClick = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFollow = resolve;
        })
    );

    render(<DataAssetsHeader {...mockProps} onFollowClick={onFollowClick} />);

    const followButton = screen.getByTestId('entity-follow-button');

    fireEvent.click(followButton);

    await waitFor(() => expect(followButton).toBeDisabled());

    fireEvent.click(followButton);

    expect(onFollowClick).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFollow();
    });
  });

  it('should render certification only when serviceCategory is undefined', () => {
    const mockCertification: AssetCertification = {
      tagLabel: {
        tagFQN: 'Certification.Bronze',
        name: 'Bronze',
        displayName: 'Bronze_Medal',
        description: 'Bronze certified Data Asset test',
        style: {
          color: '#C08329',
          iconURL: 'BronzeCertification.svg',
        },
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      appliedDate: 1732814645688,
      expiryDate: 1735406645688,
    };

    // Mock useRequiredParamsMock to return undefined serviceCategory
    const useRequiredParamsMock = useRequiredParams as jest.Mock;
    useRequiredParamsMock.mockReturnValue({
      serviceCategory: undefined,
    });

    // Test with certification when serviceCategory is undefined
    const { unmount } = render(
      <DataAssetsHeader
        {...mockProps}
        dataAsset={{
          ...mockProps.dataAsset,
          certification: mockCertification,
        }}
      />
    );

    expect(screen.getByText('label.certification')).toBeInTheDocument();

    const certificatComponent = screen.getByText(`CertificationTag`);

    expect(certificatComponent).toBeInTheDocument();

    // Clean up the first render before rendering again
    unmount();

    // Test without certification when serviceCategory is undefined
    render(<DataAssetsHeader {...mockProps} />);

    expect(screen.getByTestId('certification-label')).toContainHTML('--');

    // Reset the mock to original value
    useRequiredParamsMock.mockReturnValue({
      serviceCategory: ServiceCategory.DATABASE_SERVICES,
    });
  });

  it('should not render certification when serviceCategory has a value', () => {
    const mockCertification: AssetCertification = {
      tagLabel: {
        tagFQN: 'Certification.Bronze',
        name: 'Bronze',
        displayName: 'Bronze_Medal',
        description: 'Bronze certified Data Asset test',
        style: {
          color: '#C08329',
          iconURL: 'BronzeCertification.svg',
        },
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      appliedDate: 1732814645688,
      expiryDate: 1735406645688,
    };

    // serviceCategory is already set to DATABASE_SERVICES by default mock
    render(
      <DataAssetsHeader
        {...mockProps}
        dataAsset={{
          ...mockProps.dataAsset,
          certification: mockCertification,
        }}
      />
    );

    // Certification should not be rendered when serviceCategory has a value
    expect(screen.queryByText('label.certification')).not.toBeInTheDocument();
    expect(screen.queryByText('CertificationTag')).not.toBeInTheDocument();
    expect(screen.queryByTestId('certification-label')).not.toBeInTheDocument();
  });

  it('should not render the auto-pilot button when user has no Trigger permission (view-only policy)', () => {
    render(
      <DataAssetsHeader
        {...mockProps}
        dataAsset={{
          ...mockProps.dataAsset,
          serviceType: DatabaseServiceType.BigQuery,
        }}
        disableRunAgentsButton={false}
        entityType={EntityType.DATABASE_SERVICE}
        permissions={{
          ...DEFAULT_ENTITY_PERMISSION,
          ViewAll: true,
          ViewBasic: true,
          Trigger: false,
        }}
      />
    );

    expect(
      screen.queryByTestId('trigger-auto-pilot-application-button')
    ).not.toBeInTheDocument();
  });

  it('should not render the auto-pilot button when user has deny-all permissions', () => {
    render(
      <DataAssetsHeader
        {...mockProps}
        dataAsset={{
          ...mockProps.dataAsset,
          serviceType: DatabaseServiceType.BigQuery,
        }}
        disableRunAgentsButton={false}
        entityType={EntityType.DATABASE_SERVICE}
        permissions={DEFAULT_ENTITY_PERMISSION}
      />
    );

    expect(
      screen.queryByTestId('trigger-auto-pilot-application-button')
    ).not.toBeInTheDocument();
  });

  it('should trigger the AutoPilot application when the button is clicked', () => {
    render(
      <DataAssetsHeader
        {...mockProps}
        dataAsset={{
          ...mockProps.dataAsset,
          serviceType: DatabaseServiceType.BigQuery,
        }}
        disableRunAgentsButton={false}
        entityType={EntityType.DATABASE_SERVICE}
        permissions={{ ...DEFAULT_ENTITY_PERMISSION, Trigger: true }}
      />
    );

    const button = screen.getByTestId('trigger-auto-pilot-application-button');

    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    expect(triggerOnDemandApp).toHaveBeenCalledWith(AUTO_PILOT_APP_NAME, {
      entityLink: 'entityFeedLink',
    });
  });

  it('should disable the button when disableRunAgentsButton is true', () => {
    render(
      <DataAssetsHeader
        {...mockProps}
        disableRunAgentsButton
        dataAsset={{
          ...mockProps.dataAsset,
          serviceType: DatabaseServiceType.BigQuery,
        }}
        entityType={EntityType.DATABASE_SERVICE}
        permissions={{ ...DEFAULT_ENTITY_PERMISSION, Trigger: true }}
      />
    );

    const button = screen.getByTestId('trigger-auto-pilot-application-button');

    expect(button).toBeDisabled();
  });

  it('should enable the button when isAutoPilotWorkflowStatusLoading is false', () => {
    render(
      <DataAssetsHeader
        {...mockProps}
        dataAsset={{
          ...mockProps.dataAsset,
          serviceType: DatabaseServiceType.BigQuery,
        }}
        disableRunAgentsButton={false}
        entityType={EntityType.DATABASE_SERVICE}
        permissions={{ ...DEFAULT_ENTITY_PERMISSION, Trigger: true }}
      />
    );

    const button = screen.getByTestId('trigger-auto-pilot-application-button');

    expect(button).toBeEnabled();
  });

  it('should render the button with disableRunAgentsButtonMessage prop when provided', () => {
    const customMessage = 'Custom disable message';
    render(
      <DataAssetsHeader
        {...mockProps}
        disableRunAgentsButton
        dataAsset={{
          ...mockProps.dataAsset,
          serviceType: DatabaseServiceType.BigQuery,
        }}
        disableRunAgentsButtonMessage={customMessage}
        entityType={EntityType.DATABASE_SERVICE}
        permissions={{ ...DEFAULT_ENTITY_PERMISSION, Trigger: true }}
      />
    );

    const button = screen.getByTestId('trigger-auto-pilot-application-button');

    expect(button).toBeDisabled();
    expect(button).toBeInTheDocument();
  });

  it('should render the button when disableRunAgentsButtonMessage is not provided', () => {
    render(
      <DataAssetsHeader
        {...mockProps}
        dataAsset={{
          ...mockProps.dataAsset,
          serviceType: DatabaseServiceType.BigQuery,
        }}
        disableRunAgentsButton={false}
        entityType={EntityType.DATABASE_SERVICE}
        permissions={{ ...DEFAULT_ENTITY_PERMISSION, Trigger: true }}
      />
    );

    const button = screen.getByTestId('trigger-auto-pilot-application-button');

    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it('should not render the request data access button when getShowRequestDataAccess is false', () => {
    render(<DataAssetsHeader {...mockProps} />);

    expect(
      screen.queryByTestId('request-data-access-button')
    ).not.toBeInTheDocument();
  });

  describe('request data access button (DAR)', () => {
    const tableProps: DataAssetsHeaderProps = {
      ...mockProps,
      entityType: EntityType.TABLE,
      dataAsset: {
        id: 'table-id',
        name: 'my_table',
        fullyQualifiedName: 'service.db.schema.my_table',
        owners: [],
        columns: [],
      } as unknown as Table,
      permissions: { ...DEFAULT_ENTITY_PERMISSION, ViewAll: true },
      canCreateTask: true,
    };

    const mockListDataAccessRequests = listDataAccessRequests as jest.Mock;

    beforeEach(() => {
      mockListDataAccessRequests.mockResolvedValue({ data: [] });
      const { getShowRequestDataAccess } = jest.requireMock(
        '../../../utils/TableClassBase'
      );
      (getShowRequestDataAccess as jest.Mock).mockReturnValue(true);
    });

    afterEach(() => {
      const { getShowRequestDataAccess } = jest.requireMock(
        '../../../utils/TableClassBase'
      );
      (getShowRequestDataAccess as jest.Mock).mockReturnValue(false);
    });

    it('should not render when entity is not TABLE', () => {
      render(
        <DataAssetsHeader {...mockProps} entityType={EntityType.CONTAINER} />
      );

      expect(
        screen.queryByTestId('request-data-access-button')
      ).not.toBeInTheDocument();
    });

    it('should not render on OSS (getShowRequestDataAccess returns false)', () => {
      const { getShowRequestDataAccess } = jest.requireMock(
        '../../../utils/TableClassBase'
      );
      (getShowRequestDataAccess as jest.Mock).mockReturnValue(false);

      render(<DataAssetsHeader {...tableProps} />);

      expect(
        screen.queryByTestId('request-data-access-button')
      ).not.toBeInTheDocument();
    });

    it('should render for owner with canCreateTask permission', async () => {
      render(
        <DataAssetsHeader
          {...tableProps}
          dataAsset={{
            ...tableProps.dataAsset,
            owners: [{ id: 'user-1', type: 'user' }],
          }}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('request-data-access-button')
        ).toBeInTheDocument();
      });
    });

    it('should not render for owner without canCreateTask permission', async () => {
      render(
        <DataAssetsHeader
          {...tableProps}
          canCreateTask={false}
          dataAsset={{
            ...tableProps.dataAsset,
            owners: [{ id: 'user-1', type: 'user' }],
          }}
        />
      );

      expect(
        screen.queryByTestId('request-data-access-button')
      ).not.toBeInTheDocument();
    });

    it('should render enabled button when no existing DAR task', async () => {
      mockListDataAccessRequests.mockResolvedValue({ data: [] });

      render(<DataAssetsHeader {...tableProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('request-data-access-button')
        ).not.toBeDisabled();
      });
    });

    it('should disable button when a task is in review stage', async () => {
      mockListDataAccessRequests.mockResolvedValue({
        data: [
          {
            id: 'task-1',
            status: 'Open',
            workflowStageDisplayName: 'review',
            createdAt: Date.now(),
          },
        ],
      });

      render(<DataAssetsHeader {...tableProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('request-data-access-button')).toBeDisabled();
      });
    });

    it('should disable button when task is in approved stage and approval is still active', async () => {
      mockListDataAccessRequests.mockResolvedValue({
        data: [
          {
            id: 'task-2',
            status: 'InProgress',
            workflowStageDisplayName: 'approved',
            createdAt: Date.now() - 86_400_000,
            updatedAt: Date.now(),
            payload: { expirationDate: Date.now() + 86_400_000 },
          },
        ],
      });

      render(<DataAssetsHeader {...tableProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('request-data-access-button')).toBeDisabled();
      });
    });

    it('should enable button when task is in approved stage but approval has expired', async () => {
      mockListDataAccessRequests.mockResolvedValue({
        data: [
          {
            id: 'task-3',
            status: 'InProgress',
            workflowStageDisplayName: 'approved',
            createdAt: Date.now() - 86_400_000 * 60,
            updatedAt: Date.now() - 86_400_000 * 30,
            payload: { expirationDate: Date.now() - 1000 },
          },
        ],
      });

      render(<DataAssetsHeader {...tableProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('request-data-access-button')
        ).not.toBeDisabled();
      });
    });

    it('should use updatedAt (approval time) not createdAt for duration window', async () => {
      const approvedAt = Date.now() - 86_400_000 * 3;

      mockListDataAccessRequests.mockResolvedValue({
        data: [
          {
            id: 'task-dur',
            status: 'InProgress',
            workflowStageDisplayName: 'approved',
            createdAt: Date.now() - 86_400_000 * 30,
            updatedAt: approvedAt,
            payload: { duration: 'P7D' },
          },
        ],
      });

      render(<DataAssetsHeader {...tableProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('request-data-access-button')).toBeDisabled();
      });
    });

    it('should treat expirationDate 0 as expired (not as missing)', async () => {
      mockListDataAccessRequests.mockResolvedValue({
        data: [
          {
            id: 'task-zero-exp',
            status: 'InProgress',
            workflowStageDisplayName: 'approved',
            createdAt: Date.now() - 86_400_000,
            updatedAt: Date.now() - 86_400_000,
            payload: { expirationDate: 0 },
          },
        ],
      });

      render(<DataAssetsHeader {...tableProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('request-data-access-button')
        ).not.toBeDisabled();
      });
    });

    it('should disable when workflowStageDisplayName missing but workflowStageId is approved', async () => {
      mockListDataAccessRequests.mockResolvedValue({
        data: [
          {
            id: 'task-stageid',
            status: 'InProgress',
            workflowStageId: 'approved',
            createdAt: Date.now() - 86_400_000,
            updatedAt: Date.now(),
            payload: { expirationDate: Date.now() + 86_400_000 },
          },
        ],
      });

      render(<DataAssetsHeader {...tableProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('request-data-access-button')).toBeDisabled();
      });
    });

    it('should not call listDataAccessRequests when currentUser has no name', async () => {
      const { useApplicationStore } = jest.requireMock(
        '../../../hooks/useApplicationStore'
      );
      (useApplicationStore as jest.Mock).mockReturnValue({
        currentUser: { id: 'user-1' },
      });

      render(<DataAssetsHeader {...tableProps} />);

      await waitFor(() => {
        expect(mockListDataAccessRequests).not.toHaveBeenCalled();
      });
    });

    it('should enable button when listDataAccessRequests throws', async () => {
      mockListDataAccessRequests.mockRejectedValue(new Error('network error'));

      render(<DataAssetsHeader {...tableProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('request-data-access-button')
        ).not.toBeDisabled();
      });
    });

    it('should not render when user has no canCreateTask permission (no policy)', async () => {
      render(<DataAssetsHeader {...tableProps} canCreateTask={false} />);

      expect(
        screen.queryByTestId('request-data-access-button')
      ).not.toBeInTheDocument();
    });

    it('should not render when admin has no canCreateTask permission', () => {
      render(<DataAssetsHeader {...tableProps} canCreateTask={false} />);

      expect(
        screen.queryByTestId('request-data-access-button')
      ).not.toBeInTheDocument();
    });

    it('should render for non-admin user with canCreateTask permission', async () => {
      render(<DataAssetsHeader {...tableProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('request-data-access-button')
        ).toBeInTheDocument();
      });
    });
  });

  describe('dataContractLatestResultButton', () => {
    const mockGetDataContractStatusIcon =
      getDataContractStatusIcon as jest.Mock;
    const mockUseCustomPages = useCustomPages as jest.Mock;
    const mockGetEntityDetailsPath = getEntityDetailsPath as jest.Mock;

    it('should render data contract button when contract tab is visible and status is in allowed list', async () => {
      mockUseCustomPages.mockReturnValue({
        customizedPage: {
          tabs: [{ id: EntityTabs.CONTRACT }],
        },
      });

      (getContractByEntityId as jest.Mock).mockImplementation(() =>
        Promise.resolve(MOCK_DATA_CONTRACT)
      );

      await act(async () => {
        render(<DataAssetsHeader {...mockProps} />);
      });

      const button = screen.getByTestId('data-contract-latest-result-btn');

      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('data-contract-latest-result-button');
      expect(button).toHaveClass('failed');
    });

    it('should render data contract button when customizedPage tabs is undefined', async () => {
      mockUseCustomPages.mockReturnValue({
        customizedPage: {
          tabs: undefined,
        },
      });

      (getContractByEntityId as jest.Mock).mockImplementation(() =>
        Promise.resolve(MOCK_DATA_CONTRACT)
      );

      await act(async () => {
        render(<DataAssetsHeader {...mockProps} />);
      });

      expect(
        screen.getByTestId('data-contract-latest-result-btn')
      ).toBeInTheDocument();
    });

    it('should navigate to contract tab when button is clicked', async () => {
      mockUseCustomPages.mockReturnValue({
        customizedPage: {
          tabs: [{ id: EntityTabs.CONTRACT }],
        },
      });

      const mockDataContract = {
        ...MOCK_DATA_CONTRACT,
        latestResult: {
          status: ContractExecutionStatus.Running,
        },
      };

      (getContractByEntityId as jest.Mock).mockImplementation(() =>
        Promise.resolve(mockDataContract)
      );

      await act(async () => {
        render(<DataAssetsHeader {...mockProps} />);
      });

      const button = screen.getByTestId('data-contract-latest-result-btn');
      fireEvent.click(button);

      expect(mockGetEntityDetailsPath).toHaveBeenCalledWith(
        EntityType.CONTAINER,
        'fullyQualifiedName',
        EntityTabs.CONTRACT
      );
      expect(mockNavigate).toHaveBeenCalled();
    });

    it('should not render data contract button when contract tab is not visible', async () => {
      mockUseCustomPages.mockReturnValue({
        customizedPage: {
          tabs: [{ id: EntityTabs.ACTIVITY_FEED }],
        },
      });

      (getContractByEntityId as jest.Mock).mockImplementation(() =>
        Promise.resolve(MOCK_DATA_CONTRACT)
      );

      await act(async () => {
        render(<DataAssetsHeader {...mockProps} />);
      });

      expect(
        screen.queryByTestId('data-contract-latest-result-btn')
      ).not.toBeInTheDocument();
    });

    it('should not render data contract button when status is not in allowed list', async () => {
      mockUseCustomPages.mockReturnValue({
        customizedPage: {
          tabs: [{ id: EntityTabs.CONTRACT }],
        },
      });

      const mockDataContract = {
        ...MOCK_DATA_CONTRACT,
        latestResult: {
          status: ContractExecutionStatus.Success,
        },
      };

      (getContractByEntityId as jest.Mock).mockImplementation(() =>
        Promise.resolve(mockDataContract)
      );

      await act(async () => {
        render(<DataAssetsHeader {...mockProps} />);
      });

      expect(
        screen.queryByTestId('data-contract-latest-result-btn')
      ).not.toBeInTheDocument();
    });

    it('should not render data contract button when dataContract is undefined', async () => {
      mockUseCustomPages.mockReturnValue({
        customizedPage: {
          tabs: [{ id: EntityTabs.CONTRACT }],
        },
      });

      (getContractByEntityId as jest.Mock).mockImplementation(() =>
        Promise.resolve()
      );

      await act(async () => {
        render(<DataAssetsHeader {...mockProps} />);
      });

      expect(
        screen.queryByTestId('data-contract-latest-result-btn')
      ).not.toBeInTheDocument();
    });

    it('should not render data contract button when latestResult is undefined', async () => {
      mockUseCustomPages.mockReturnValue({
        customizedPage: {
          tabs: [{ id: EntityTabs.CONTRACT }],
        },
      });

      const mockDataContract = {
        ...MOCK_DATA_CONTRACT,
        latestResult: undefined,
      };

      (getContractByEntityId as jest.Mock).mockImplementation(() =>
        Promise.resolve(mockDataContract)
      );

      await act(async () => {
        render(<DataAssetsHeader {...mockProps} />);
      });

      expect(
        screen.queryByTestId('data-contract-latest-result-btn')
      ).not.toBeInTheDocument();
    });

    it('should render button with icon when getDataContractStatusIcon returns an icon', async () => {
      mockUseCustomPages.mockReturnValue({
        customizedPage: { tabs: [{ id: EntityTabs.CONTRACT }] },
      });
      const TestIcon = (props: { className?: string }) => (
        <svg {...props} data-testid="contract-status-icon" />
      );
      mockGetDataContractStatusIcon.mockReturnValue(TestIcon);

      (getContractByEntityId as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ...MOCK_DATA_CONTRACT,
          latestResult: { status: ContractExecutionStatus.Failed },
        })
      );

      await act(async () => {
        render(<DataAssetsHeader {...mockProps} />);
      });

      const button = screen.getByTestId('data-contract-latest-result-btn');

      expect(button.querySelector('[data-icon="leading"]')).toBeInTheDocument();
    });

    it('should render button without icon when getDataContractStatusIcon returns null', async () => {
      mockUseCustomPages.mockReturnValue({
        customizedPage: { tabs: [{ id: EntityTabs.CONTRACT }] },
      });
      mockGetDataContractStatusIcon.mockReturnValue(null);

      (getContractByEntityId as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ...MOCK_DATA_CONTRACT,
          latestResult: { status: ContractExecutionStatus.Failed },
        })
      );

      await act(async () => {
        render(<DataAssetsHeader {...mockProps} />);
      });

      const button = screen.getByTestId('data-contract-latest-result-btn');

      expect(button.querySelector('.anticon')).not.toBeInTheDocument();
    });
  });
});
