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

import { findByText, getByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { deleteWebhook, getWebhookByName } from '../../axiosAPIs/webhookAPI';
import EditWebhookPage from './EditWebhookPage.component';

const mockAuthContext = {
  isAuthDisabled: true,
};

const mockAdminData = {
  isAdminUser: true,
};

jest.mock('../../components/AddWebhook/AddWebhook', () => {
  return jest.fn().mockReturnValue(<div>AddWebhookComponent</div>);
});

jest.mock('../../components/Loader/Loader', () => {
  return jest.fn().mockReturnValue(<p>LoaderComponent</p>);
});

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockImplementation(() => mockAdminData),
}));

jest.mock('../../auth-provider/AuthProvider', () => ({
  useAuthContext: jest.fn().mockImplementation(() => mockAuthContext),
}));

jest.mock('../../axiosAPIs/webhookAPI', () => ({
  getWebhookByName: jest.fn().mockImplementation(() => Promise.resolve()),
  updateWebhook: jest.fn(),
  deleteWebhook: jest.fn(),
}));

jest.mock('../../hooks/useToastContext', () => {
  return jest.fn().mockImplementation(() => jest.fn());
});

describe('Test DatasetDetails page', () => {
  it('Component should render', async () => {
    const { container } = render(<EditWebhookPage />, {
      wrapper: MemoryRouter,
    });
    const addWebhookComponent = await findByText(
      container,
      /AddWebhookComponent/i
    );

    expect(addWebhookComponent).toBeInTheDocument();
  });

  it('Component should render even if auth is not disabled, and user is not admin', async () => {
    mockAuthContext.isAuthDisabled = false;
    mockAdminData.isAdminUser = false;

    const { container } = render(<EditWebhookPage />, {
      wrapper: MemoryRouter,
    });

    const addWebhookComponent = await findByText(
      container,
      /AddWebhookComponent/i
    );

    expect(addWebhookComponent).toBeInTheDocument();
  });

  it('Component should render even if auth is not disabled, and user is admin', async () => {
    mockAuthContext.isAuthDisabled = false;

    const { container } = render(<EditWebhookPage />, {
      wrapper: MemoryRouter,
    });

    const addWebhookComponent = await findByText(
      container,
      /AddWebhookComponent/i
    );

    expect(addWebhookComponent).toBeInTheDocument();
  });

  it('Component should render even if auth is disabled, and user is not admin', async () => {
    mockAdminData.isAdminUser = false;

    const { container } = render(<EditWebhookPage />, {
      wrapper: MemoryRouter,
    });

    const addWebhookComponent = await findByText(
      container,
      /AddWebhookComponent/i
    );

    expect(addWebhookComponent).toBeInTheDocument();
  });

  it('If loading is true, it should render loading component', () => {
    const { container } = render(<EditWebhookPage />, {
      wrapper: MemoryRouter,
    });

    const loader = getByText(container, /LoaderComponent/i);

    expect(loader).toBeInTheDocument();
  });

  describe('Render Sad Paths', () => {
    it('Show error message on failing of getWebhookByName api', async () => {
      (getWebhookByName as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'Error!' } },
        })
      );
      const { container } = render(<EditWebhookPage />, {
        wrapper: MemoryRouter,
      });
      const addWebhookComponent = await findByText(
        container,
        /AddWebhookComponent/i
      );

      expect(addWebhookComponent).toBeInTheDocument();
    });

    it('Show error message on failing of deleteWebhook api', async () => {
      (deleteWebhook as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'Error!' } },
        })
      );
      const { container } = render(<EditWebhookPage />, {
        wrapper: MemoryRouter,
      });
      const addWebhookComponent = await findByText(
        container,
        /AddWebhookComponent/i
      );

      expect(addWebhookComponent).toBeInTheDocument();
    });
  });
});
