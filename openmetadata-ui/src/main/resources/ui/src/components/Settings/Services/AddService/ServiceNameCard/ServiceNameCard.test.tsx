/*
 *  Copyright 2025 Collate.
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
import userEvent from '@testing-library/user-event';
import ServiceNameCard from './ServiceNameCard';

const defaultProps = {
  description: '',
  name: 'snowflake_service',
  onDescriptionChange: jest.fn(),
  onNameChange: jest.fn(),
  serviceType: 'Snowflake',
};

jest.mock('../../../../common/RichTextEditor/RichTextEditor', () =>
  jest
    .fn()
    .mockImplementation(({ initialValue, onFocus, onTextChange }) => (
      <textarea
        data-testid="service-description"
        value={initialValue ?? ''}
        onChange={(e) => onTextChange?.(e.target.value)}
        onFocus={onFocus}
      />
    ))
);

describe('ServiceNameCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips optional add description action in the required field tab order', async () => {
    const user = userEvent.setup({
      advanceTimers: jest.advanceTimersByTime,
    });

    render(
      <>
        <ServiceNameCard {...defaultProps} />
        <input data-testid="next-required-field" />
      </>
    );

    const serviceName = screen.getByTestId('service-name');
    const addDescription = screen.getByTestId('add-description-button');
    const nextRequiredField = screen.getByTestId('next-required-field');

    await user.click(serviceName);

    expect(addDescription).toHaveAttribute('tabIndex', '-1');

    await user.tab();

    expect(addDescription).not.toHaveFocus();
    expect(nextRequiredField).toHaveFocus();
  });

  it('shows the optional description field when requested and reports focus', async () => {
    const user = userEvent.setup({
      advanceTimers: jest.advanceTimersByTime,
    });
    const onFocus = jest.fn();

    render(<ServiceNameCard {...defaultProps} onFocus={onFocus} />);

    await user.click(screen.getByTestId('add-description-button'));

    expect(onFocus).toHaveBeenCalledWith('serviceDescription');
    expect(screen.getByTestId('service-description')).toBeInTheDocument();
  });

  it('renders existing descriptions and updates the text area value', async () => {
    const onDescriptionChange = jest.fn();
    const onFocus = jest.fn();

    render(
      <ServiceNameCard
        {...defaultProps}
        description="Existing description"
        onDescriptionChange={onDescriptionChange}
        onFocus={onFocus}
      />
    );

    const description = screen.getByTestId('service-description');

    expect(description).toHaveValue('Existing description');

    fireEvent.focus(description);
    fireEvent.change(description, {
      target: {
        value: 'Updated',
      },
    });

    expect(onFocus).toHaveBeenCalledWith('serviceDescription');
    expect(onDescriptionChange).toHaveBeenLastCalledWith('Updated');
  });
});
