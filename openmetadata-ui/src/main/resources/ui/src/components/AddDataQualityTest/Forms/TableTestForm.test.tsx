import { findByTestId, findByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import TableTestForm from './TableTestForm';

const mockFunction = jest.fn();

jest.mock('../../common/rich-text-editor/RichTextEditor', () => {
  return jest.fn().mockReturnValue(<div>MarkdownWithPreview component</div>);
});

describe('Test TableTestForm component', () => {
  it('TableTestForm component should be render properly', async () => {
    const { container } = render(
      <TableTestForm
        handleAddTableTestCase={mockFunction}
        tableTestCase={[]}
        onFormCancel={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const tableTestType = await findByTestId(container, 'tableTestType');
    const cancelButton = await findByTestId(container, 'cancel-test');
    const saveButton = await findByTestId(container, 'save-test');
    const value = await findByTestId(container, 'value');
    const frequency = await findByTestId(container, 'frequency');
    const description = await findByText(
      container,
      /MarkdownWithPreview component/i
    );

    expect(tableTestType).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(value).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(saveButton).toBeInTheDocument();
    expect(frequency).toBeInTheDocument();
  });
});
