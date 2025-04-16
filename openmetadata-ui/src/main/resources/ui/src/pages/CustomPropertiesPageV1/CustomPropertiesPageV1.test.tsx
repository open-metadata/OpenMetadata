/*
 *  Copyright 2024 Collate.
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
import userEvent from '@testing-library/user-event';
import { EntityTabs } from '../../enums/entity.enum';
import { Type } from '../../generated/entity/type';
import CustomEntityDetailV1 from './CustomPropertiesPageV1';

const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
  useParams: jest.fn().mockReturnValue({
    tab: EntityTabs.CUSTOM_PROPERTIES,
  }),
}));

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn(() => <div>TitleBreadcrumb</div>)
);

jest.mock(
  '../../components/Settings/CustomProperty/CustomPropertyTable',
  () => ({
    CustomPropertyTable: jest.fn(({ updateEntityType }) => (
      <button onClick={() => updateEntityType([] as Type['customProperties'])}>
        Update Entity Type
      </button>
    )),
  })
);

jest.mock('../../components/PageHeader/PageHeader.component', () =>
  jest.fn().mockReturnValue(<div>PageHeader</div>)
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn(({ children }) => <div>{children}</div>)
);

const mockGetEntityPermission = jest.fn().mockResolvedValue({
  EditAll: true,
});

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermission: jest.fn(() => mockGetEntityPermission()),
  })),
}));

jest.mock('../../components/Database/SchemaEditor/SchemaEditor', () => {
  return jest.fn().mockImplementation(() => <div>SchemaEditor</div>);
});

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () =>
  jest.fn().mockImplementation(({ name }) => <div>{name}</div>)
);

const mockUpdateType = jest.fn().mockResolvedValue({});
const mockGetTypeByFQN = jest.fn().mockResolvedValue({ id: 'id' });

jest.mock('../../rest/metadataTypeAPI', () => ({
  getTypeByFQN: jest.fn(() => mockGetTypeByFQN()),
  updateType: jest.fn(() => mockUpdateType()),
}));

jest.mock('../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn(),
}));

const mockShowErrorToast = jest.fn();

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn((...args) => mockShowErrorToast(...args)),
}));

describe('CustomPropertiesPageV1 component', () => {
  it('actions check during render', async () => {
    await act(async () => {
      render(<CustomEntityDetailV1 />);
    });

    expect(mockGetTypeByFQN).toHaveBeenCalled();
    expect(mockGetEntityPermission).toHaveBeenCalled();
  });

  it('tab change should work properly', async () => {
    await act(async () => {
      render(<CustomEntityDetailV1 />);
    });

    act(() => {
      userEvent.click(
        screen.getByRole('tab', {
          name: 'label.schema',
        })
      );
    });

    expect(screen.getByText('SchemaEditor')).toBeInTheDocument();
  });

  it('update entity type should call updateType api', async () => {
    await act(async () => {
      render(<CustomEntityDetailV1 />);
    });

    await act(async () => {
      userEvent.click(
        screen.getByRole('button', {
          name: 'Update Entity Type',
        })
      );
    });

    expect(mockUpdateType).toHaveBeenCalled();
  });

  it('add entity should call mockPush', async () => {
    await act(async () => {
      render(<CustomEntityDetailV1 />);
    });

    userEvent.click(
      screen.getByRole('button', {
        name: 'label.add-entity',
      })
    );

    expect(mockPush).toHaveBeenCalled();
  });

  it('failed in fetch entityType should not fetch permission', async () => {
    const ERROR = 'Error in fetching type';
    mockGetTypeByFQN.mockRejectedValueOnce(ERROR);

    await act(async () => {
      render(<CustomEntityDetailV1 />);
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith(ERROR);
    expect(mockGetEntityPermission).not.toHaveBeenCalled();
  });

  it('errors check', async () => {
    mockGetEntityPermission.mockRejectedValueOnce('Error');
    mockUpdateType.mockRejectedValueOnce('Error');

    await act(async () => {
      render(<CustomEntityDetailV1 />);
    });

    // update entity type
    await act(async () => {
      userEvent.click(
        screen.getByRole('button', {
          name: 'Update Entity Type',
        })
      );
    });

    expect(mockShowErrorToast).toHaveBeenCalledTimes(2);
  });
});
