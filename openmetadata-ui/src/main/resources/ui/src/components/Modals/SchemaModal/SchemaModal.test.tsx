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

import { act, fireEvent, render, screen } from '@testing-library/react';
import ReactDOM from 'react-dom';
import { MemoryRouter } from 'react-router-dom';
import SchemaModal from './SchemaModal';

const onClose = jest.fn();
const onSave = jest.fn();

const mockProp = {
  onSave,
  onClose,
  data: {},
};

jest.mock('../../Database/SchemaEditor/SchemaEditor', () => {
  return jest.fn().mockReturnValue(<div>SchemaEditor</div>);
});

describe('Test Schema modal component', () => {
  beforeAll(() => {
    ReactDOM.createPortal = jest.fn().mockImplementation((element, _node) => {
      return element;
    });
  });

  it('Should render schema modal component', async () => {
    await act(async () => {
      render(<SchemaModal visible {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });

    const modalContainer = await screen.findByTestId('schema-modal');

    expect(modalContainer).toBeInTheDocument();

    expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();

    const modalBody = await screen.findByTestId('schema-modal-body');

    expect(modalBody).toBeInTheDocument();
  });

  it('Should call onClose method on click of close button', async () => {
    render(<SchemaModal visible {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    fireEvent.click(await screen.findByRole('button', { name: /close/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
