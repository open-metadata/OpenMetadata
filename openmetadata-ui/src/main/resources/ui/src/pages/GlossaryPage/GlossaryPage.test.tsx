import { findByText, render } from '@testing-library/react';
import React from 'react';
import GlossaryPageV1 from './GlossaryPageV1.component';

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

jest.mock('../../components/Glossary/GlossaryV1.component', () => {
  return jest.fn().mockReturnValue(<div>Glossary.component</div>);
});

jest.mock('../../axiosAPIs/glossaryAPI', () => ({
  getGlossaries: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('Test GlossaryComponent page', () => {
  it('GlossaryComponent Page Should render', async () => {
    const { container } = render(<GlossaryPageV1 />);

    const glossaryComponent = await findByText(
      container,
      /Glossary.component/i
    );

    expect(glossaryComponent).toBeInTheDocument();
  });
});
