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

const LABEL_NAME = 'label.name';
const LABEL_ENDPOINT = 'label.endpoint';
const HTTPS_WWW_GOOGLE_COM = 'https://www.google.com';

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

    const nameInputs = getAllByPlaceholderText(LABEL_NAME);
    const endpointInputs = getAllByPlaceholderText(LABEL_ENDPOINT);
    await act(async () => {
      fireEvent.click(getByTestId('save-btn'));

      expect(mockOnSave).toHaveBeenCalledTimes(0);

      fireEvent.change(nameInputs[0], { target: { value: 'google' } });
      fireEvent.change(endpointInputs[0], {
        target: { value: HTTPS_WWW_GOOGLE_COM },
      });

      fireEvent.click(getByTestId('save-btn'));
    });

    expect(nameInputs[0]).toHaveValue('google');
    expect(endpointInputs[0]).toHaveValue(HTTPS_WWW_GOOGLE_COM);
    expect(getByTestId('save-btn')).toBeInTheDocument();

    expect(mockOnSave).toHaveBeenCalledTimes(1);

    expect(mockOnSave.mock.calls).toEqual([
      [[{ name: 'google', endpoint: HTTPS_WWW_GOOGLE_COM }]],
    ]);
  });

  it('should reject URLs without http:// or https:// prefix', async () => {
    const { getAllByPlaceholderText, getByTestId, findByText } = render(
      <GlossaryTermReferencesModal {...{ ...defaultProps, references: [] }} />
    );

    const nameInputs = getAllByPlaceholderText(LABEL_NAME);
    const endpointInputs = getAllByPlaceholderText(LABEL_ENDPOINT);

    await act(async () => {
      fireEvent.change(nameInputs[0], { target: { value: 'BBC' } });
      fireEvent.change(endpointInputs[0], {
        target: { value: 'www.bbc.co.uk' },
      });

      fireEvent.click(getByTestId('save-btn'));
    });

    const errorMessage = await findByText(
      'message.url-must-start-with-http-or-https'
    );

    expect(errorMessage).toBeInTheDocument();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should accept URLs with http:// prefix', async () => {
    const { getAllByPlaceholderText, getByTestId } = render(
      <GlossaryTermReferencesModal {...{ ...defaultProps, references: [] }} />
    );

    const nameInputs = getAllByPlaceholderText(LABEL_NAME);
    const endpointInputs = getAllByPlaceholderText(LABEL_ENDPOINT);

    await act(async () => {
      fireEvent.change(nameInputs[0], { target: { value: 'BBC' } });
      fireEvent.change(endpointInputs[0], {
        // eslint-disable-next-line sonarjs/no-clear-text-protocols -- test input fixture, not a network call
        target: { value: 'http://www.bbc.co.uk' },
      });

      fireEvent.click(getByTestId('save-btn'));
    });

    expect(mockOnSave).toHaveBeenCalledWith([
      // eslint-disable-next-line sonarjs/no-clear-text-protocols -- test expectation fixture, not a network call
      { name: 'BBC', endpoint: 'http://www.bbc.co.uk' },
    ]);
  });
});
