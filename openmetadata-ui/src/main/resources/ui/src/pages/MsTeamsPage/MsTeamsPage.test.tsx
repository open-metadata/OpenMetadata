import { findByTestId, findByText, render } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getWebhooks } from '../../axiosAPIs/webhookAPI';
import MSTeamsPage from './MsTeamsPage.component';

jest.mock('../../components/containers/PageContainerV1', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="PageContainerV1">{children}</div>
    ));
});

jest.mock('../../components/Webhooks/WebhooksV1', () => {
  return jest.fn().mockImplementation(() => <div>WebhooksComponent</div>);
});

jest.mock('../../axiosAPIs/webhookAPI', () => ({
  deleteWebhook: jest.fn(),
  getWebhooks: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('Test WebhooksPage component', () => {
  it('WebhooksPage component should render properly', async () => {
    const { container } = render(<MSTeamsPage />, {
      wrapper: MemoryRouter,
    });

    const PageContainerV1 = await findByTestId(container, 'PageContainerV1');
    const MSTeamsComponent = await findByText(container, /MsTeamsComponent/i);

    expect(PageContainerV1).toBeInTheDocument();
    expect(MSTeamsComponent).toBeInTheDocument();
  });

  it('Should render WebhooksPage component if Api fails', async () => {
    (getWebhooks as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        response: {
          data: {
            message: 'Error!',
          },
        },
      })
    );

    const { container } = render(<MSTeamsPage />, {
      wrapper: MemoryRouter,
    });

    const PageContainerV1 = await findByTestId(container, 'PageContainerV1');
    const MSTeamsComponent = await findByText(container, /MsTeamsComponent/i);

    expect(PageContainerV1).toBeInTheDocument();
    expect(MSTeamsComponent).toBeInTheDocument();
  });
});
