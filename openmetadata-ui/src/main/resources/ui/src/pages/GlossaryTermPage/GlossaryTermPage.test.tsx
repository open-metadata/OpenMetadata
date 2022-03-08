import { findByText, render } from '@testing-library/react';
import React from 'react';
import GlossaryTermPage from './GlossaryTermPage.component';

jest.mock('../../components/GlossaryTerms/GlossaryTerms.component', () => {
  return jest.fn().mockReturnValue(<div>GlossaryTerms.component</div>);
});

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

jest.mock('../../axiosAPIs/glossaryAPI', () => ({
  getGlossariesByName: jest.fn().mockImplementation(() => Promise.resolve()),
  getGlossaryTermsById: jest.fn().mockImplementation(() => Promise.resolve()),
  getGlossaryTerms: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue('glossaryTerm1'),
  useLocation: jest.fn().mockReturnValue({
    search: '',
  }),
}));

jest.mock('../../components/containers/PageContainer', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ));
});

describe('Test GlossaryComponent page', () => {
  it('GlossaryComponent Page Should render', async () => {
    const { container } = render(<GlossaryTermPage />);

    const glossaryTermsComponent = await findByText(
      container,
      /GlossaryTerms.component/i
    );

    expect(glossaryTermsComponent).toBeInTheDocument();
  });
});
