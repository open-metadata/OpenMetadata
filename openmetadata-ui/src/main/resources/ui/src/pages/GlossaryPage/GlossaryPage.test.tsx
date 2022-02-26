import { findByText, render } from '@testing-library/react';
import React from 'react';
import GlossaryPage from './GlossaryPage.component';

jest.mock('../../components/Glossary/Glossary.component', () => {
  return jest.fn().mockReturnValue(<div>Glossary.component</div>);
});

jest.mock('../../axiosAPIs/glossaryAPI', () => ({
  getGlossaries: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('Test GlossaryComponent page', () => {
  it('GlossaryComponent Page Should render', async () => {
    const { container } = render(<GlossaryPage />);

    const glossaryComponent = await findByText(
      container,
      /Glossary.component/i
    );

    expect(glossaryComponent).toBeInTheDocument();
  });
});
