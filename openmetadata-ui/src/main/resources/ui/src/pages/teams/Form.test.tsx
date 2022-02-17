import { findByTestId, findByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Form from './Form';

const mockFunction = jest.fn();

jest.mock('../../components/common/editor/MarkdownWithPreview', () => {
  return jest.fn().mockReturnValue(<div>MarkdownWithPreview component</div>);
});

describe('Test TeamsPage Form component', () => {
  it('Form component should render properly', async () => {
    const { container } = render(
      <Form
        initialData={{
          id: '',
          name: '',
          displayName: '',
          description: '',
          href: '',
          users: [],
          owns: [],
        }}
        saveData={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const name = await findByTestId(container, 'name');
    const displayName = await findByTestId(container, 'displayName');

    expect(name).toBeInTheDocument();
    expect(displayName).toBeInTheDocument();
    expect(
      await findByText(container, /MarkdownWithPreview component/i)
    ).toBeInTheDocument();
  });
});
