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

import { act, render, screen } from '@testing-library/react';
import { GenericTab } from '../../components/Customization/GenericTab/GenericTab';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { getStoredProceduresByFqn } from '../../rest/storedProceduresAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { STORED_PROCEDURE_DEFAULT_FIELDS } from '../../utils/StoredProceduresUtils';
import StoredProcedurePage from './StoredProcedurePage';

const mockEntityPermissionByFqn = jest
  .fn()
  .mockImplementation(() => DEFAULT_ENTITY_PERMISSION);

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: mockEntityPermissionByFqn,
  })),
}));

jest.mock('../../rest/storedProceduresAPI', () => ({
  getStoredProceduresByFqn: jest.fn().mockImplementation(() =>
    Promise.resolve({
      name: 'test',
      id: '123',
    })
  ),
  addStoredProceduresFollower: jest.fn(),
  patchStoredProceduresDetails: jest.fn(),
  removeStoredProceduresFollower: jest.fn(),
  restoreStoredProcedures: jest.fn(),
}));

jest.mock('../../utils/CommonUtils', () => ({
  getFeedCounts: jest.fn(),
  sortTagsCaseInsensitive: jest.fn(),
}));

jest.mock(
  '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest
      .fn()
      .mockImplementation(() => <p>testActivityFeedTab</p>),
  })
);

jest.mock(
  '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel',
  () => {
    return jest.fn().mockImplementation(() => <p>testActivityThreadPanel</p>);
  }
);

jest.mock('../../components/common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockImplementation(() => <p>testDescriptionV1</p>);
});

jest.mock('../../components/Lineage/Lineage.component', () => {
  return jest.fn().mockImplementation(() => <p>testEntityLineageComponent</p>);
});

jest.mock(
  '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => {
    return jest.fn().mockImplementation(() => <p>testErrorPlaceHolder</p>);
  }
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <p>{children}</p>);
});

jest.mock(
  '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest
      .fn()
      .mockImplementation(() => <p>testDataAssetsHeader</p>),
  })
);

jest.mock('../../components/Lineage/Lineage.component', () => {
  return jest.fn().mockImplementation(() => <p>testEntityLineage</p>);
});

jest.mock('../../components/Database/SchemaEditor/SchemaEditor', () => {
  return jest.fn().mockImplementation(() => <p>testSchemaEditor</p>);
});

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () => {
  return jest.fn().mockImplementation(({ name }) => <p>{name}</p>);
});

jest.mock('../../components/Tag/TagsContainerV2/TagsContainerV2', () => {
  return jest.fn().mockImplementation(() => <p>testTagsContainerV2</p>);
});

jest.mock(
  '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest.fn().mockImplementation(() => ({
      postFeed: jest.fn(),
      deleteFeed: jest.fn(),
      updateFeed: jest.fn(),
    })),
    __esModule: true,
    default: 'ActivityFeedProvider',
  })
);

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => ({ fqn: 'fqn', tab: 'code' })),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <>testLoader</>);
});

jest.mock('../../hoc/LimitWrapper', () => {
  return jest.fn().mockImplementation(({ children }) => <p>{children}</p>);
});

jest.mock('../../components/Customization/GenericTab/GenericTab', () => ({
  GenericTab: jest.fn().mockImplementation(() => <p>GenericTab</p>),
}));

jest.mock('../../utils/TableColumn.util', () => ({
  ownerTableObject: jest.fn().mockReturnValue({}),
}));

describe('StoredProcedure component', () => {
  it('StoredProcedurePage should fetch permissions', () => {
    render(<StoredProcedurePage />);

    expect(mockEntityPermissionByFqn).toHaveBeenCalledWith(
      'storedProcedure',
      'fqn'
    );
  });

  it('StoredProcedurePage should not fetch details if permission is there', () => {
    render(<StoredProcedurePage />);

    expect(getStoredProceduresByFqn).not.toHaveBeenCalled();
  });

  it('StoredProcedurePage should fetch details with basic fields', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      render(<StoredProcedurePage />);
    });

    expect(getStoredProceduresByFqn).toHaveBeenCalledWith('fqn', {
      fields: STORED_PROCEDURE_DEFAULT_FIELDS,
      include: 'all',
    });
  });

  it('StoredProcedurePage should fetch details with all the permitted fields', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewAll: true,
        ViewBasic: true,
        ViewUsage: true,
      })),
    }));

    await act(async () => {
      render(<StoredProcedurePage />);
    });

    expect(getStoredProceduresByFqn).toHaveBeenCalledWith('fqn', {
      fields: STORED_PROCEDURE_DEFAULT_FIELDS,
      include: 'all',
    });
  });

  it('StoredProcedurePage should render permission placeholder if not have required permission', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: false,
      })),
    }));

    await act(async () => {
      render(<StoredProcedurePage />);
    });

    expect(await screen.findByText('testErrorPlaceHolder')).toBeInTheDocument();
  });

  it('StoredProcedurePage should render page for ViewBasic permissions', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      render(<StoredProcedurePage />);
    });

    expect(getStoredProceduresByFqn).toHaveBeenCalledWith('fqn', {
      fields: STORED_PROCEDURE_DEFAULT_FIELDS,
      include: 'all',
    });

    expect(await screen.findByText('testDataAssetsHeader')).toBeInTheDocument();
    expect(await screen.findByText('label.code')).toBeInTheDocument();
    expect(
      await screen.findByText('label.activity-feed-and-task-plural')
    ).toBeInTheDocument();
    expect(await screen.findByText('label.lineage')).toBeInTheDocument();
    expect(
      await screen.findByText('label.custom-property-plural')
    ).toBeInTheDocument();
  });

  it('StoredProcedurePage should render codeTab by default', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      render(<StoredProcedurePage />);
    });

    expect(getStoredProceduresByFqn).toHaveBeenCalledWith('fqn', {
      fields: STORED_PROCEDURE_DEFAULT_FIELDS,
      include: 'all',
    });

    expect(await screen.findByText('GenericTab')).toBeInTheDocument();
    expect(GenericTab).toHaveBeenCalledWith({ type: 'StoredProcedure' }, {});
  });
});
