/*
 *  Copyright 2023 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import GlossaryTermReferencesModal from './GlossaryTermReferencesModal.component';

const mockOnSave = jest.fn();
const mockOnClose = jest.fn();

const references = [
  { name: 'Reference 1', endpoint: 'http://example.com/1' },
  { name: 'Reference 2', endpoint: 'http://example.com/2' },
];

const defaultProps = {
  references,
  isVisible: true,
  onClose: mockOnClose,
  onSave: mockOnSave,
};

describe('GlossaryTermReferencesModal', () => {
  it('renders correctly', () => {
    render(<GlossaryTermReferencesModal {...defaultProps} />);

    expect(screen.getByText('label.reference-plural')).toBeInTheDocument();
    expect(screen.getByText('label.add')).toBeInTheDocument();
    expect(screen.getByText('label.cancel')).toBeInTheDocument();
    expect(screen.getByText('label.save')).toBeInTheDocument();
  });

  it('clicking Save button calls onSave with updated references', async () => {
    const { getAllByPlaceholderText, getByTestId } = render(
      <GlossaryTermReferencesModal {...{ ...defaultProps, references: [] }} />
    );

    const nameInputs = getAllByPlaceholderText('label.name');
    const endpointInputs = getAllByPlaceholderText('label.endpoint');
    await act(async () => {
      fireEvent.click(getByTestId('save-btn'));

      expect(mockOnSave).toHaveBeenCalledTimes(0);

      fireEvent.change(nameInputs[0], { target: { value: 'google' } });
      fireEvent.change(endpointInputs[0], {
        target: { value: 'https://www.google.com' },
      });

      fireEvent.click(getByTestId('save-btn'));
    });

    expect(nameInputs[0]).toHaveValue('google');
    expect(endpointInputs[0]).toHaveValue('https://www.google.com');
    expect(getByTestId('save-btn')).toBeInTheDocument();

    expect(mockOnSave).toHaveBeenCalledTimes(1);

    expect(mockOnSave.mock.calls).toEqual([
      [[{ name: 'google', endpoint: 'https://www.google.com' }]],
    ]);
  });
});
