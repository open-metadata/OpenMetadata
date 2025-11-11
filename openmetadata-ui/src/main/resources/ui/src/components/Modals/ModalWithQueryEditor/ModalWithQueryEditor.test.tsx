/*
 *  Copyright 2024 Collate.
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
import { act, fireEvent, render } from '@testing-library/react';
import { ModalWithQueryEditor } from './ModalWithQueryEditor';

describe('ModalWithQueryEditor', () => {
  const onSaveMock = jest.fn();
  const onCancelMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the modal with the correct header', () => {
    const header = 'Test Header';
    const { getByTestId } = render(
      <ModalWithQueryEditor
        visible
        header={header}
        value=""
        onCancel={onCancelMock}
        onSave={onSaveMock}
      />
    );
    const headerElement = getByTestId('header');

    expect(headerElement).toBeInTheDocument();
    expect(headerElement).toHaveTextContent(header);
  });

  it('calls onSave with the correct value when save button is clicked', async () => {
    const value = 'Test Query';
    const { getByTestId } = render(
      <ModalWithQueryEditor
        visible
        header=""
        value={value}
        onCancel={onCancelMock}
        onSave={onSaveMock}
      />
    );
    const saveButton = getByTestId('save');

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(onSaveMock).toHaveBeenCalledWith(value);
  });

  it('calls onCancel when cancel button is clicked', () => {
    const { getByTestId } = render(
      <ModalWithQueryEditor
        visible
        header=""
        value=""
        onCancel={onCancelMock}
        onSave={onSaveMock}
      />
    );
    const cancelButton = getByTestId('cancel');
    fireEvent.click(cancelButton);

    expect(onCancelMock).toHaveBeenCalled();
  });
});
