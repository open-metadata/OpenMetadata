import { fireEvent, getByTestId, render } from '@testing-library/react';
import React from 'react';
import { ModalWithMarkdownEditor } from './ModalWithMarkdownEditor';

const mockOnSave = jest.fn();
const mockOnCancel = jest.fn();
const mockValue = 'Test value';

jest.mock('../../common/editor/MarkdownWithPreview', () => {
  return () => jest.fn().mockImplementation(() => mockValue);
});

describe('Test ModalWithMarkdownEditor Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <ModalWithMarkdownEditor
        header="Test"
        placeholder="Test placeholder"
        value={mockValue}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const editor = getByTestId(container, 'markdown-editor');

    expect(editor).toBeInTheDocument();
  });

  it('Component should have same header as provided', () => {
    const { container } = render(
      <ModalWithMarkdownEditor
        header="Test"
        placeholder="Test placeholder"
        value={mockValue}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const header = getByTestId(container, 'header');

    expect(header.textContent).toBe('Test');
  });

  it('on click of cancel button, onCancel callback should call', () => {
    const { container } = render(
      <ModalWithMarkdownEditor
        header="Test"
        placeholder="Test placeholder"
        value={mockValue}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const cancel = getByTestId(container, 'cancel');

    fireEvent.click(cancel);

    expect(mockOnCancel).toBeCalledTimes(1);
  });
});
