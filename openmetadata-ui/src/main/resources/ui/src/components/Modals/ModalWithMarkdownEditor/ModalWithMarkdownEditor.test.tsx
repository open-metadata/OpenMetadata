/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { fireEvent, getByTestId, render } from '@testing-library/react';
import React from 'react';
import { ModalWithMarkdownEditor } from './ModalWithMarkdownEditor';

const mockOnSave = jest.fn();
const mockOnCancel = jest.fn();
const mockValue = 'Test value';

jest.mock('../../common/rich-text-editor/RichTextEditor', () => {
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
