/*
 *  Copyright 2022 Collate.
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
import { LoadingState } from 'Models';
import React, { forwardRef } from 'react';
import AddGlossary from './AddGlossary.component';

jest.mock('../containers/PageLayout', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

jest.mock('../common/rich-text-editor/RichTextEditor', () => {
  return forwardRef(
    jest.fn().mockImplementation(({ initialValue }) => {
      return (
        <div
          ref={(input) => {
            return {
              getEditorContent: input,
            };
          }}>
          {initialValue}RichTextEditor
        </div>
      );
    })
  );
});

jest.mock('rest/glossaryAPI', () => ({
  addGlossaries: jest.fn().mockImplementation(() => Promise.resolve()),
}));

const mockOnCancel = jest.fn();
const mockOnSave = jest.fn();

const mockProps = {
  header: 'Header',
  allowAccess: true,
  saveState: 'initial' as LoadingState,
  onCancel: mockOnCancel,
  onSave: mockOnSave,
  slashedBreadcrumb: [],
};

describe('Test AddGlossary component', () => {
  it('AddGlossary component should render', () => {
    const { container } = render(<AddGlossary {...mockProps} />);

    const addGlossaryForm = getByTestId(container, 'add-glossary');

    expect(addGlossaryForm).toBeInTheDocument();
  });

  it('should be able to cancel', () => {
    const { container } = render(<AddGlossary {...mockProps} />);

    const cancelButton = getByTestId(container, 'cancel-glossary');

    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(
      cancelButton,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should be able to save', () => {
    jest.spyOn(React, 'useRef').mockReturnValue({
      current: { getEditorContent: jest.fn().mockReturnValue('description') },
    });
    const { container } = render(<AddGlossary {...mockProps} />);

    const nameInput = getByTestId(container, 'name');
    const saveButton = getByTestId(container, 'save-glossary');

    expect(saveButton).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'Test Glossary' } });

    fireEvent.click(
      saveButton,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockOnSave).toHaveBeenCalled();
  });

  it('should not be able to save', () => {
    jest.spyOn(React, 'useRef').mockReturnValue({
      current: { getEditorContent: jest.fn().mockReturnValue('') },
    });
    const { container } = render(<AddGlossary {...mockProps} />);

    const nameInput = getByTestId(container, 'name');
    const saveButton = getByTestId(container, 'save-glossary');

    expect(saveButton).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'Test Glossary' } });

    fireEvent.click(
      saveButton,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockOnSave).not.toHaveBeenCalled();
  });
});
