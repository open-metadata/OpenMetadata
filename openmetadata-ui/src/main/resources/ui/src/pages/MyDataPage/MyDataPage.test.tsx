/*
 *  Copyright 2021 Collate
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

import { findByText, queryByText, render } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { getAllDashboards } from '../../axiosAPIs/dashboardAPI';
import { fetchSandboxConfig } from '../../axiosAPIs/miscAPI';
import { getAllPipelines } from '../../axiosAPIs/pipelineAPI';
import { getAllTables } from '../../axiosAPIs/tableAPI';
import { getAllTopics } from '../../axiosAPIs/topicsAPI';
import { getAllServices } from '../../utils/ServiceUtils';
import MyDataPageComponent from './MyDataPage.component';

const mockAuth = {
  isAuthDisabled: true,
};

const mockErrors = {
  sandboxMode: 'SandboxModeError',
};

jest.mock('../../components/MyData/MyData.component', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="my-data-component">Mydata component</p>);
});

jest.mock('../../axiosAPIs/miscAPI', () => ({
  searchData: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        aggregations: {
          'sterms#Service': {
            buckets: [],
          },
        },
        hits: [],
      },
    })
  ),
  fetchSandboxConfig: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        sandboxModeEnabled: false,
      },
    })
  ),
}));

jest.mock('../../axiosAPIs/tableAPI', () => ({
  getAllTables: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        data: [],
        paging: {
          total: 3,
        },
      },
    })
  ),
}));

jest.mock('../../axiosAPIs/topicsAPI', () => ({
  getAllTopics: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        data: [],
        paging: {
          total: 3,
        },
      },
    })
  ),
}));

jest.mock('../../axiosAPIs/dashboardAPI', () => ({
  getAllDashboards: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        data: [],
        paging: {
          total: 3,
        },
      },
    })
  ),
}));

jest.mock('../../axiosAPIs/pipelineAPI', () => ({
  getAllPipelines: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        data: [],
        paging: {
          total: 3,
        },
      },
    })
  ),
}));

jest.mock('../../axiosAPIs/feedsAPI', () => ({
  getFeedsWithFilter: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        data: [],
      },
    })
  ),
}));

jest.mock('../../utils/ServiceUtils', () => ({
  getAllServices: jest.fn().mockImplementation(() => Promise.resolve(['test'])),
  getEntityCountByService: jest.fn().mockReturnValue({
    tableCount: 0,
    topicCount: 0,
    dashboardCount: 0,
    pipelineCount: 0,
  }),
}));

jest.mock('../../utils/CommonUtils', () => ({
  isSandboxOMD: jest.fn().mockReturnValue(true),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn(() => mockAuth),
}));

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockReturnValue({
    pathname: 'pathname',
  }),
}));

jest.mock('../../utils/APIUtils', () => ({
  formatDataResponse: jest.fn(),
}));

jest.mock('../../components/containers/PageContainerV1', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="PageContainerV1">{children}</div>
    ));
});

jest.mock('../../components/MyData/MyData.component', () => {
  return jest.fn().mockImplementation(() => <p>MyData.component</p>);
});

jest.mock('../../components/GithubStarButton/GithubStarButton', () => {
  return jest.fn().mockImplementation(() => <p>GithubStarButton.component</p>);
});

jest.mock('../../components/common/Toast/Toast', () => {
  return jest.fn().mockImplementation(() => <p>GithubStarButton.component</p>);
});

describe('Test MyData page component', () => {
  it('Component should render', async () => {
    const { container } = render(<MyDataPageComponent />);
    const myData = await findByText(container, /MyData.component/i);

    const githubStarButton = await queryByText(
      container,
      /GithubStarButton.component/i
    );

    expect(myData).toBeInTheDocument();
    expect(githubStarButton).not.toBeInTheDocument();
  });

  it('Component should render in sandbox mode', async () => {
    (fetchSandboxConfig as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: {
          sandboxModeEnabled: true,
        },
      })
    );

    const { container } = render(<MyDataPageComponent />);
    const myData = await findByText(container, /MyData.component/i);

    const githubStarButton = await findByText(
      container,
      /GithubStarButton.component/i
    );

    expect(myData).toBeInTheDocument();
    expect(githubStarButton).toBeInTheDocument();
  });

  describe('render Sad Paths', () => {
    it('show error message on failing of config/sandbox api', async () => {
      (fetchSandboxConfig as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: mockErrors.sandboxMode } },
        })
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      const githubStarButton = await queryByText(
        container,
        /GithubStarButton.component/i
      );

      expect(myData).toBeInTheDocument();
      expect(githubStarButton).not.toBeInTheDocument();
    });

    it('show error message on no data from config/sandbox api', async () => {
      (fetchSandboxConfig as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({})
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      const githubStarButton = await queryByText(
        container,
        /GithubStarButton.component/i
      );

      expect(myData).toBeInTheDocument();
      expect(githubStarButton).not.toBeInTheDocument();
    });

    it('should render component if table count api fails', async () => {
      (getAllTables as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'Error!' } },
        })
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      expect(myData).toBeInTheDocument();
    });

    it('should render component if table count api has no data', async () => {
      (getAllTables as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({})
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      expect(myData).toBeInTheDocument();
    });

    it('should render component if table count api has no paging', async () => {
      (getAllTables as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            data: [],
          },
        })
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      expect(myData).toBeInTheDocument();
    });

    it('should render component if topic count api fails', async () => {
      (getAllTopics as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'Error!' } },
        })
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      expect(myData).toBeInTheDocument();
    });

    it('should render component if topic count api has no data', async () => {
      (getAllTopics as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({})
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      expect(myData).toBeInTheDocument();
    });

    it('should render component if topic count api has no paging', async () => {
      (getAllTopics as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            data: [],
          },
        })
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      expect(myData).toBeInTheDocument();
    });

    it('should render component if dashboard count api fails', async () => {
      (getAllDashboards as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'Error!' } },
        })
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      expect(myData).toBeInTheDocument();
    });

    it('should render component if dashboard count api has no data', async () => {
      (getAllDashboards as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({})
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      expect(myData).toBeInTheDocument();
    });

    it('should render component if dashboard count api has no paging', async () => {
      (getAllDashboards as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            data: [],
          },
        })
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      expect(myData).toBeInTheDocument();
    });

    it('should render component if pipeline count api fails', async () => {
      (getAllPipelines as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'Error!' } },
        })
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      expect(myData).toBeInTheDocument();
    });

    it('should render component if pipeline count api has no data', async () => {
      (getAllPipelines as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({})
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      expect(myData).toBeInTheDocument();
    });

    it('should render component if pipeline count api has no paging', async () => {
      (getAllPipelines as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            data: [],
          },
        })
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      expect(myData).toBeInTheDocument();
    });

    it('should render component if service util fails', async () => {
      (getAllServices as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'Error!' } },
        })
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      expect(myData).toBeInTheDocument();
    });

    it('should render component if service util has no data', async () => {
      (getAllServices as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve([{}])
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      expect(myData).toBeInTheDocument();
    });

    it('should render component if service util has no paging', async () => {
      (getAllServices as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve([
          {
            data: {
              data: [],
            },
          },
        ])
      );

      const { container } = render(<MyDataPageComponent />);
      const myData = await findByText(container, /MyData.component/i);

      expect(myData).toBeInTheDocument();
    });
  });
});
