/*
 *  Copyright 2026 Collate.
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
import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { TitleComponent } from './TitleComponent';

const mockHandleChange = jest.fn();
const mockOnKeyDown = jest.fn();

const mockProps = {
  value: 'test-value',
  onChange: mockHandleChange,
  onKeyDown: mockOnKeyDown,
  autoFocus: true,
  readOnly: false,
};

describe('TitleComponent', () => {
  it('should render TitleComponent', () => {
    render(<TitleComponent {...mockProps} />);

    expect(
      screen.getByTestId('entity-header-display-name')
    ).toBeInTheDocument();

    expect(screen.getByTestId('entity-header-display-name')).toHaveValue(
      'test-value'
    );
  });

  it('should render TitleComponent with readOnly', () => {
    render(<TitleComponent {...mockProps} readOnly />);

    expect(
      screen.getByTestId('entity-header-display-name')
    ).toBeInTheDocument();

    expect(screen.getByTestId('entity-header-display-name')).toHaveValue(
      'test-value'
    );

    expect(screen.getByTestId('entity-header-display-name')).toHaveAttribute(
      'readOnly'
    );
  });

  it('should expose textarea ref', () => {
    const ref = createRef<HTMLTextAreaElement>();

    render(<TitleComponent {...mockProps} ref={ref} />);

    expect(
      screen.getByTestId('entity-header-display-name')
    ).toBeInTheDocument();

    expect(ref.current).toBe(screen.getByTestId('entity-header-display-name'));
  });

  it('should render TitleComponent with onKeyDown', async () => {
    render(<TitleComponent {...mockProps} onKeyDown={mockOnKeyDown} />);

    const input = screen.getByTestId('entity-header-display-name');

    expect(input).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockOnKeyDown).toHaveBeenCalled();
  });

  it('should render TitleComponent with onChange', async () => {
    render(<TitleComponent {...mockProps} onChange={mockHandleChange} />);

    const input = screen.getByTestId('entity-header-display-name');

    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'test' } });

    expect(mockHandleChange).toHaveBeenCalled();
  });
});
