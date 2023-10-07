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
import React from 'react';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { getStoredProceduresDetailsByFQN } from '../../rest/storedProceduresAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import StoredProcedurePage from './StoredProcedurePage';

const mockEntityPermissionByFqn = jest
  .fn()
  .mockImplementation(() => DEFAULT_ENTITY_PERMISSION);

const API_FIELDS = `owner, followers, 
tags, domain, votes`;

jest.mock('../../components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: mockEntityPermissionByFqn,
  })),
}));

jest.mock('../../rest/storedProceduresAPI', () => ({
  getStoredProceduresDetailsByFQN: jest.fn().mockImplementation(() =>
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
  getCurrentUserId: jest.fn(),
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

jest.mock('../../components/common/description/DescriptionV1', () => {
  return jest.fn().mockImplementation(() => <p>testDescriptionV1</p>);
});

jest.mock(
  '../../components/Entity/EntityLineage/EntityLineage.component',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <p>testEntityLineageComponent</p>);
  }
);

jest.mock(
  '../../components/common/error-with-placeholder/ErrorPlaceHolder',
  () => {
    return jest.fn().mockImplementation(() => <p>testErrorPlaceHolder</p>);
  }
);

jest.mock('../../components/containers/PageLayoutV1', () => {
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

jest.mock(
  '../../components/Entity/EntityLineage/EntityLineage.component',
  () => {
    return jest.fn().mockImplementation(() => <p>testEntityLineage</p>);
  }
);

jest.mock('../../components/schema-editor/SchemaEditor', () => {
  return jest.fn().mockImplementation(() => <p>testSchemaEditor</p>);
});

jest.mock('../../components/TabsLabel/TabsLabel.component', () => {
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
  useHistory: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../components/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <>testLoader</>);
});

jest.useFakeTimers();

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

    expect(getStoredProceduresDetailsByFQN).not.toHaveBeenCalled();
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

    expect(getStoredProceduresDetailsByFQN).toHaveBeenCalledWith(
      'fqn',
      API_FIELDS
    );
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

    expect(getStoredProceduresDetailsByFQN).toHaveBeenCalledWith(
      'fqn',
      API_FIELDS
    );
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

    expect(getStoredProceduresDetailsByFQN).toHaveBeenCalledWith(
      'fqn',
      API_FIELDS
    );

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

    expect(getStoredProceduresDetailsByFQN).toHaveBeenCalledWith(
      'fqn',
      API_FIELDS
    );

    expect(await screen.findByText('testSchemaEditor')).toBeInTheDocument();
  });
});
