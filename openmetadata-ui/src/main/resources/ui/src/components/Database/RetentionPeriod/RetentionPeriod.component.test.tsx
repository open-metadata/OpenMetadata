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
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import RetentionPeriod from './RetentionPeriod.component';
import { RetentionPeriodProps } from './RetentionPeriod.interface';

const EDIT_RETENTION_PERIOD_BUTTON = 'edit-retention-period-button';
const RETENTION_PERIOD_CONTAINER = 'retention-period-container';
const RETENTION_PERIOD_MODAL = 'retention-period-modal';
const _69_DAYS_AND_16_HOURS = '69 days and 16 hours';
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/DataAssetsHeader.utils', () => ({
  ExtraInfoLabel: jest.fn().mockImplementation(({ value }) => value),
}));

const mockOnUpdate = jest.fn();

const mockRetentionPeriodProps: RetentionPeriodProps = {
  retentionPeriod: undefined,
  onUpdate: mockOnUpdate,
  hasPermission: true,
};

describe('Test Retention Period Component', () => {
  it('Should render Retention Period Component', () => {
    render(<RetentionPeriod {...mockRetentionPeriodProps} />);

    expect(screen.getByTestId(RETENTION_PERIOD_CONTAINER)).toBeInTheDocument();

    expect(screen.getByText(NO_DATA_PLACEHOLDER)).toBeInTheDocument();

    expect(
      screen.getByTestId(EDIT_RETENTION_PERIOD_BUTTON)
    ).toBeInTheDocument();
  });

  it('Should render Retention Period Component with value', () => {
    render(
      <RetentionPeriod
        {...mockRetentionPeriodProps}
        retentionPeriod={_69_DAYS_AND_16_HOURS}
      />
    );

    expect(screen.getByTestId(RETENTION_PERIOD_CONTAINER)).toBeInTheDocument();

    expect(screen.getByText(_69_DAYS_AND_16_HOURS)).toBeInTheDocument();
  });

  it('Should render Modal on edit button click', () => {
    render(<RetentionPeriod {...mockRetentionPeriodProps} />);

    const editButton = screen.getByTestId(EDIT_RETENTION_PERIOD_BUTTON);

    act(() => {
      fireEvent.click(editButton);
    });

    expect(screen.getByTestId(RETENTION_PERIOD_MODAL)).toBeInTheDocument();
  });

  it('Should render Modal with input and value', async () => {
    render(
      <RetentionPeriod
        {...mockRetentionPeriodProps}
        retentionPeriod={_69_DAYS_AND_16_HOURS}
      />
    );

    const editButton = screen.getByTestId(EDIT_RETENTION_PERIOD_BUTTON);

    act(() => {
      fireEvent.click(editButton);
    });

    expect(screen.getByTestId(RETENTION_PERIOD_MODAL)).toBeInTheDocument();

    expect(screen.getByTestId('retention-period-input')).toHaveValue(
      _69_DAYS_AND_16_HOURS
    );
  });

  it('Should call onUpdate  with no value and on submit form', async () => {
    render(<RetentionPeriod {...mockRetentionPeriodProps} />);

    const editButton = screen.getByTestId(EDIT_RETENTION_PERIOD_BUTTON);

    act(() => {
      fireEvent.click(editButton);
    });

    expect(screen.getByTestId(RETENTION_PERIOD_MODAL)).toBeInTheDocument();

    const saveButton = screen.getByText('label.save');

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(undefined);
  });

  it('Should call onUpdate with value on submit form', async () => {
    render(<RetentionPeriod {...mockRetentionPeriodProps} />);

    const editButton = screen.getByTestId(EDIT_RETENTION_PERIOD_BUTTON);

    act(() => {
      fireEvent.click(editButton);
    });

    expect(screen.getByTestId(RETENTION_PERIOD_MODAL)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('retention-period-input'), {
      target: { value: _69_DAYS_AND_16_HOURS },
    });

    const saveButton = screen.getByText('label.save');

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(_69_DAYS_AND_16_HOURS);
  });

  it('Should render correctly with ISO 8601 duration P0Y0M4D', () => {
    render(
      <RetentionPeriod
        {...mockRetentionPeriodProps}
        retentionPeriod="P0Y0M4D"
      />
    );

    expect(screen.getByText('4 days')).toBeInTheDocument();
  });

  it('Should render correctly with ISO 8601 duration P0Y0M4W', () => {
    render(
      <RetentionPeriod
        {...mockRetentionPeriodProps}
        retentionPeriod="P0Y0M4W"
      />
    );

    expect(screen.getByText('4 weeks')).toBeInTheDocument();
  });

  it('Should render correctly with ISO 8601 duration P0Y1M1DT1H30M', () => {
    render(
      <RetentionPeriod
        {...mockRetentionPeriodProps}
        retentionPeriod="P2Y1M1DT1H30M"
      />
    );

    expect(
      screen.getByText('2 years 1 month 1 day 1 hour 30 minutes')
    ).toBeInTheDocument();
  });

  it('Should not render Retention Period Component if has no permission', () => {
    render(
      <RetentionPeriod {...mockRetentionPeriodProps} hasPermission={false} />
    );

    expect(screen.getByTestId(RETENTION_PERIOD_CONTAINER)).toBeInTheDocument();

    expect(screen.getByText(NO_DATA_PLACEHOLDER)).toBeInTheDocument();
    expect(
      screen.queryByTestId(EDIT_RETENTION_PERIOD_BUTTON)
    ).not.toBeInTheDocument();
  });
});
