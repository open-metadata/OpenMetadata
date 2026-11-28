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

import { Button } from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import RetentionPeriod, {
  formatRetentionPeriod,
} from './RetentionPeriod.component';

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockOnUpdate = jest.fn();

const renderRetentionPeriod = (retentionPeriod?: string) =>
  render(
    <RetentionPeriod retentionPeriod={retentionPeriod} onUpdate={mockOnUpdate}>
      <Button data-testid="edit-retention-period-button">edit</Button>
    </RetentionPeriod>
  );

const openEditor = () =>
  act(() => {
    fireEvent.click(screen.getByTestId('edit-retention-period-button'));
  });

describe('Test Retention Period Component', () => {
  beforeEach(() => mockOnUpdate.mockClear());

  it('renders only the trigger until it is pressed', () => {
    renderRetentionPeriod();

    expect(
      screen.getByTestId('edit-retention-period-button')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('retention-period-modal')
    ).not.toBeInTheDocument();
  });

  it('opens the editor with the current value', () => {
    renderRetentionPeriod('69 days and 16 hours');
    openEditor();

    expect(screen.getByTestId('retention-period-modal')).toBeInTheDocument();
    expect(screen.getByTestId('retention-period-input')).toHaveValue(
      '69 days and 16 hours'
    );
  });

  it('saves an untouched empty field as undefined', async () => {
    renderRetentionPeriod();
    openEditor();

    await act(async () => {
      fireEvent.click(screen.getByText('label.save'));
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(undefined);
  });

  it('saves the typed value', async () => {
    renderRetentionPeriod();
    openEditor();

    fireEvent.change(screen.getByTestId('retention-period-input'), {
      target: { value: '69 days and 16 hours' },
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.save'));
    });

    expect(mockOnUpdate).toHaveBeenCalledWith('69 days and 16 hours');
  });

  it('closes without saving on cancel', async () => {
    renderRetentionPeriod();
    openEditor();

    fireEvent.click(screen.getByTestId('cancel-button'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('retention-period-modal')
      ).not.toBeInTheDocument()
    );

    expect(mockOnUpdate).not.toHaveBeenCalled();
  });
});

describe('formatRetentionPeriod', () => {
  it.each([
    [undefined, NO_DATA_PLACEHOLDER],
    ['69 days and 16 hours', '69 days and 16 hours'],
    ['P0Y0M4D', '4 days'],
    ['P0Y0M4W', '4 weeks'],
    ['P2Y1M1DT1H30M', '2 years 1 month 1 day 1 hour 30 minutes'],
    ['P0D', NO_DATA_PLACEHOLDER],
  ])('formats %s as %s', (value, expected) => {
    expect(formatRetentionPeriod(value)).toBe(expected);
  });
});
