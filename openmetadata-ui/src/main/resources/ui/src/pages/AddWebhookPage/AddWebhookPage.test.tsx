import { findByTestId, findByText, render } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import AddWebhookPage from './AddWebhookPage.component';

jest.mock('../../components/containers/PageContainerV1', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="PageContainerV1">{children}</div>
    ));
});

jest.mock('../../authentication/auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

jest.mock('../../components/AddWebhook/AddWebhook', () => {
  return jest.fn().mockImplementation(() => <div>AddWebhookComponent</div>);
});

jest.mock('../../axiosAPIs/webhookAPI', () => ({
  addWebhook: jest.fn(),
}));

describe('Test AddWebhookPage component', () => {
  it('AddWebhookPage component should render properly', async () => {
    const { container } = render(<AddWebhookPage />, {
      wrapper: MemoryRouter,
    });

    const PageContainerV1 = await findByTestId(container, 'PageContainerV1');
    const AddWebhookComponent = await findByText(
      container,
      /AddWebhookComponent/i
    );

    expect(PageContainerV1).toBeInTheDocument();
    expect(AddWebhookComponent).toBeInTheDocument();
  });
});
