import { findByTestId, findByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Form from './Form';

const mockFunction = jest.fn();
const mockInitialData = {
  categoryType: 'Descriptive',
  description: '',
  name: '',
};

jest.mock('../../components/common/editor/MarkdownWithPreview', () => {
  return jest.fn().mockReturnValue(<div>MarkdownWithPreview component</div>);
});

describe('Test RolesPage component', () => {
  it('RolesPage component should render properly', async () => {
    const { container } = render(
      <Form initialData={mockInitialData} saveData={mockFunction} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const categoryType = await findByTestId(container, 'category-type');
    const name = await findByTestId(container, 'name');

    expect(categoryType).toBeInTheDocument();
    expect(name).toBeInTheDocument();
    expect(
      await findByText(container, /MarkdownWithPreview component/i)
    ).toBeInTheDocument();
  });
});
