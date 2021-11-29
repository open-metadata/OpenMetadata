import { findByTestId, findByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import appState from '../../AppState';
import SigninPage from './index';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
}));

jest.mock(
  '../../components/containers/PageContainer',
  () =>
    ({ children }: { children: React.ReactNode }) =>
      <div data-testid="PageContainer">{children}</div>
);

describe('Test SigninPage Component', () => {
  it('Component should render', async () => {
    const { container } = render(<SigninPage />, {
      wrapper: MemoryRouter,
    });
    const servicePage = await findByTestId(container, 'signin-page');

    expect(servicePage).toBeInTheDocument();
  });

  it('Sign in button should render', async () => {
    const { container } = render(<SigninPage />, {
      wrapper: MemoryRouter,
    });
    const store = appState;
    store.authProvider.provider = 'google';
    const signinButton = await findByText(container, /Sign in with google/i);

    expect(store.authProvider.provider).toBe('google');
    expect(signinButton).toBeInTheDocument();
  });
});
