import { findByTestId, findByText, render } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import WebhooksPage from './WebhooksPage.component';

jest.mock('../../components/containers/PageContainerV1', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="PageContainerV1">{children}</div>
    ));
});

jest.mock('../../components/Webhooks/Webhooks', () => {
  return jest.fn().mockImplementation(() => <div>WebhooksComponent</div>);
});

jest.mock('../../axiosAPIs/webhookAPI', () => ({
  deleteWebhook: jest.fn(),
  getWebhooks: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('Test WebhooksPage component', () => {
  it('WebhooksPage component should render properly', async () => {
    const { container } = render(<WebhooksPage />, {
      wrapper: MemoryRouter,
    });

    const PageContainerV1 = await findByTestId(container, 'PageContainerV1');
    const WebhooksComponent = await findByText(container, /WebhooksComponent/i);

    expect(PageContainerV1).toBeInTheDocument();
    expect(WebhooksComponent).toBeInTheDocument();
  });
});
