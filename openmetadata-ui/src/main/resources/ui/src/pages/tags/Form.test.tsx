import { findByTestId, findByText, render } from '@testing-library/react';
import React, { forwardRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import Form from './Form';

const mockFunction = jest.fn();
const mockInitialData = {
  categoryType: 'Descriptive',
  description: '',
  name: '',
};

jest.mock('../../components/common/rich-text-editor/RichTextEditor', () => {
  return forwardRef(
    jest.fn().mockImplementation(({ initialValue }, ref) => {
      return <div ref={ref}>{initialValue}MarkdownWithPreview component</div>;
    })
  );
});

describe('Test TagsPage form component', () => {
  it('Form component should render properly', async () => {
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
