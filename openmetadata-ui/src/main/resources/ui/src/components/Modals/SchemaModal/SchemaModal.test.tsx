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

import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import ReactDOM from 'react-dom';
import { MemoryRouter } from 'react-router-dom';
import SchemaModal from './SchemaModal';

const onClose = jest.fn();

const mockProp = {
  onClose,
  data: {},
};

jest.mock('../../schema-editor/SchemaEditor', () => {
  return jest.fn().mockReturnValue(<div>SchemaEditor</div>);
});

describe('Test Schema modal component', () => {
  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ReactDOM.createPortal = jest.fn().mockImplementation((element, _node) => {
      return element;
    });
  });

  it('Should render schema modal component', async () => {
    const { findByTestId } = render(<SchemaModal {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const modalContainer = await findByTestId('schema-modal');

    expect(modalContainer).toBeInTheDocument();

    const modalBackdrop = await findByTestId('schema-modal-backdrop');

    expect(modalBackdrop).toBeInTheDocument();

    const header = await findByTestId('schema-modal-header');

    expect(header).toBeInTheDocument();

    const modalCloseButton = await findByTestId('schema-modal-close-button');

    expect(modalCloseButton).toBeInTheDocument();

    const modalBody = await findByTestId('schem-modal-body');

    expect(modalBody).toBeInTheDocument();
  });

  it('Should call onClose method on click of backedrop', async () => {
    const { findByTestId } = render(<SchemaModal {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const modalBackdrop = await findByTestId('schema-modal-backdrop');

    expect(modalBackdrop).toBeInTheDocument();

    fireEvent.click(modalBackdrop);

    expect(onClose).toBeCalled();
  });

  it('Should call onClose method on click of close button', async () => {
    const { findByTestId } = render(<SchemaModal {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const modalCloseButton = await findByTestId('schema-modal-close-button');

    expect(modalCloseButton).toBeInTheDocument();

    fireEvent.click(modalCloseButton);

    expect(onClose).toBeCalled();
  });
});
