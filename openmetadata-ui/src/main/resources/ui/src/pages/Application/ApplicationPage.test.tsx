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
import { ROUTES } from '../../constants/constants';
import { CursorType } from '../../enums/pagination.enum';
import LimitWrapper from '../../hoc/LimitWrapper';
import ApplicationPage from './ApplicationPage';

const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
}));

jest.mock(
  '../../components/Settings/Applications/ApplicationCard/ApplicationCard.component',
  () =>
    jest.fn(({ onClick }) => <button onClick={onClick}>ApplicationCard</button>)
);

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('../../components/common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockImplementation(({ pagingHandler }) => (
    <button
      onClick={() =>
        pagingHandler({
          currentPage: 5,
          cursorType: CursorType.AFTER,
        })
      }>
      NextPrevious
    </button>
  ));
});

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn(() => <div>TitleBreadcrumb</div>)
);

jest.mock('../../components/PageHeader/PageHeader.component', () =>
  jest.fn(() => <div>PageHeader</div>)
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    currentPage: 1,
    paging: {},
    pageSize: 10,
    showPagination: true,
    handlePageChange: jest.fn(),
    handlePagingChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
  }),
}));

const mockGetApplicationList = jest
  .fn()
  .mockResolvedValue({ data: [{}], paging: {} });

jest.mock('../../rest/applicationAPI', () => ({
  getApplicationList: jest.fn(() => mockGetApplicationList()),
}));

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Test'),
}));

jest.mock('../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn().mockImplementation(() => [
    {
      name: 'setting',
      url: ROUTES.SETTINGS,
    },
  ]),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getApplicationDetailsPath: jest.fn(),
}));

const mockShowErrorToast = jest.fn();

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn((...args) => mockShowErrorToast(...args)),
}));

jest.mock('../../hoc/LimitWrapper', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => <>LimitWrapper{children}</>);
});

describe('ApplicationPage', () => {
  it('should render all necessary elements', async () => {
    await act(async () => {
      render(<ApplicationPage />);
    });

    expect(screen.getByText('TitleBreadcrumb')).toBeInTheDocument();
    expect(screen.getByText('PageHeader')).toBeInTheDocument();
    expect(screen.getByText('label.disabled')).toBeInTheDocument();
    expect(screen.getByText('ApplicationCard')).toBeInTheDocument();
    expect(screen.getByText('NextPrevious')).toBeInTheDocument();
    expect(screen.getByText('label.add-entity')).toBeInTheDocument();
  });

  it('actions check', async () => {
    await act(async () => {
      render(<ApplicationPage />);
    });

    await act(async () => {
      userEvent.click(screen.getByTestId('show-disabled'));
      userEvent.click(
        screen.getByRole('button', {
          name: 'NextPrevious',
        })
      );
    });

    // 1 time call when render component, 2 time call for above actions
    expect(mockGetApplicationList).toHaveBeenCalledTimes(3);

    // add application
    userEvent.click(
      screen.getByRole('button', {
        name: 'label.add-entity',
      })
    );

    // view app details
    userEvent.click(
      screen.getByRole('button', {
        name: 'ApplicationCard',
      })
    );

    //  add application + view app details
    expect(mockPush).toHaveBeenCalledTimes(2);
  });

  it('error while fetching application list', async () => {
    mockGetApplicationList.mockRejectedValueOnce('ERROR');

    await act(async () => {
      render(<ApplicationPage />);
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith('ERROR');
    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('should call limitWrapper with app as resource', async () => {
    await act(async () => {
      render(<ApplicationPage />);
    });

    expect(LimitWrapper).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'app' }),
      {}
    );
  });
});
