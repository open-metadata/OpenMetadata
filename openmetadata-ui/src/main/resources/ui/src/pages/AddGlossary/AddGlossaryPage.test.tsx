import { findByText, render } from '@testing-library/react';
import React from 'react';
import AddGlossaryPage from './AddGlossaryPage.component';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
}));

jest.mock('../../auth-provider/AuthProvider', () => {
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

jest.mock('../../components/AddGlossary/AddGlossary.component', () => {
  return jest.fn().mockReturnValue(<div>AddGlossary.component</div>);
});

jest.mock('../../axiosAPIs/glossaryAPI', () => ({
  addGlossaries: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('Test AddGlossary component page', () => {
  it('AddGlossary component page should render', async () => {
    const { container } = render(<AddGlossaryPage />);

    const addGlossary = await findByText(container, /AddGlossary.component/i);

    expect(addGlossary).toBeInTheDocument();
  });
});
