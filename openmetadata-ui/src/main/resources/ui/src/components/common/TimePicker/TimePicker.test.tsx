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

import { TimePicker } from '@openmetadata/ui-core-components';
import { fireEvent, render, screen } from '@testing-library/react';

describe('TimePicker (core-components)', () => {
  it('should render the label and hint', () => {
    render(
      <TimePicker
        hint="Pick a time"
        label="Time"
        value={{ hour: 6, minute: 0 }}
      />
    );

    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Pick a time')).toBeInTheDocument();
  });

  it('should render time segments for the provided value', () => {
    render(<TimePicker label="Time" value={{ hour: 6, minute: 30 }} />);

    const segments = screen.getAllByRole('spinbutton');

    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('AM')).toBeInTheDocument();
  });

  it('should emit the updated value when a segment is incremented', () => {
    const onChange = jest.fn();
    render(
      <TimePicker
        label="Time"
        value={{ hour: 6, minute: 0 }}
        onChange={onChange}
      />
    );

    const minuteSegment = screen.getByLabelText(/minute/i);
    fireEvent.keyDown(minuteSegment, { key: 'ArrowUp' });

    expect(onChange).toHaveBeenCalledWith({ hour: 6, minute: 1 });
  });

  it('should not emit changes when disabled', () => {
    const onChange = jest.fn();
    render(
      <TimePicker
        isDisabled
        label="Time"
        value={{ hour: 6, minute: 0 }}
        onChange={onChange}
      />
    );

    const minuteSegment = screen.getByLabelText(/minute/i);
    fireEvent.keyDown(minuteSegment, { key: 'ArrowUp' });

    expect(onChange).not.toHaveBeenCalled();
  });
});
