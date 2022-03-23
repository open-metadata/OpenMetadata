import { findByText, render } from '@testing-library/react';
import React from 'react';
import AddGlossaryTermPage from './AddGlossaryTermPage.component';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockReturnValue({
    glossaryName: 'GlossaryName',
  }),
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

jest.mock('../../components/AddGlossaryTerm/AddGlossaryTerm.component', () => {
  return jest.fn().mockReturnValue(<div>AddGlossaryTerm.component</div>);
});

jest.mock('../../axiosAPIs/glossaryAPI', () => ({
  addGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
  getGlossariesByName: jest.fn().mockImplementation(() => Promise.resolve()),
  getGlossaryTermByFQN: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('Test AddGlossaryTerm component page', () => {
  it('AddGlossaryTerm component page should render', async () => {
    const { container } = render(<AddGlossaryTermPage />);

    const addGlossaryTerm = await findByText(
      container,
      /AddGlossaryTerm.component/i
    );

    expect(addGlossaryTerm).toBeInTheDocument();
  });
});
