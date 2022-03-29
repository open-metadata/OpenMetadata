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

import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import CopyToClipboardButton from './CopyToClipboardButton';

const mockProps = {
  copyText: 'mock-copy',
};

jest.mock('../../common/popover/PopOver', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p data-testid="popover">{children}</p>
    ));
});

describe('Test CopyToClipboardButton Component', () => {
  it('Should render all child elements', () => {
    const { container } = render(<CopyToClipboardButton {...mockProps} />, {
      wrapper: MemoryRouter,
    });
    const popover = getByTestId(container, 'popover');
    const copyIcon = getByTestId(container, 'copy-icon');

    expect(popover).toBeInTheDocument();
    expect(copyIcon).toBeInTheDocument();
  });
});
