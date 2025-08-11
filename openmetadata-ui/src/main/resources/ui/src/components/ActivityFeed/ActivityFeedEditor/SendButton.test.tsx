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

import { findByTestId, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SendButton } from './SendButton';

const onSaveHandler = jest.fn();

const mockProp = {
  editorValue: 'xyz',
  buttonClass: '',
  onSaveHandler,
};

describe('Test SendButton Component', () => {
  it('Should call onSaveHandler', async () => {
    const { container } = render(<SendButton {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const sendButton = await findByTestId(container, 'send-button');

    expect(sendButton).toBeInTheDocument();

    fireEvent.click(sendButton);

    expect(onSaveHandler).toHaveBeenCalled();
  });

  it('Button Should be disabled if editorvalue length is 0', async () => {
    const { container } = render(<SendButton {...mockProp} editorValue="" />, {
      wrapper: MemoryRouter,
    });

    const sendButton = await findByTestId(container, 'send-button');

    expect(sendButton).toBeInTheDocument();

    expect(sendButton).toBeDisabled();
  });
});
