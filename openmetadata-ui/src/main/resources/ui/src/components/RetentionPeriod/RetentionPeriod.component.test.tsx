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
import React from 'react';
import { NO_DATA_PLACEHOLDER } from '../../constants/constants';
import RetentionPeriod from './RetentionPeriod.component';
import { RetentionPeriodProps } from './RetentionPeriod.interface';

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../DataAssets/DataAssetsHeader/DataAssetsHeader.component', () => ({
  ExtraInfoLabel: jest.fn().mockImplementation(({ value }) => value),
}));

const mockOnUpdate = jest.fn();

const mockRetentionPeriodProps: RetentionPeriodProps = {
  retentionPeriod: undefined,
  onUpdate: mockOnUpdate,
};

describe('Test Retention Period Component', () => {
  it('Should render Retention Period Component', () => {
    render(<RetentionPeriod {...mockRetentionPeriodProps} />);

    expect(
      screen.getByTestId('retention-period-container')
    ).toBeInTheDocument();

    expect(screen.getByText(NO_DATA_PLACEHOLDER)).toBeInTheDocument();

    expect(
      screen.getByTestId('edit-retention-period-button')
    ).toBeInTheDocument();
  });

  it('Should render Retention Period Component with value', () => {
    render(
      <RetentionPeriod {...mockRetentionPeriodProps} retentionPeriod="P69D" />
    );

    expect(
      screen.getByTestId('retention-period-container')
    ).toBeInTheDocument();

    expect(screen.getByText('69 days')).toBeInTheDocument();
  });

  it('Should render Modal on edit button click', () => {
    render(<RetentionPeriod {...mockRetentionPeriodProps} />);

    const editButton = screen.getByTestId('edit-retention-period-button');

    act(() => {
      fireEvent.click(editButton);
    });

    expect(screen.getByTestId('retention-period-modal')).toBeInTheDocument();
  });

  it('Should render Modal day input with value', async () => {
    render(
      <RetentionPeriod
        {...mockRetentionPeriodProps}
        retentionPeriod="P23DT23H"
      />
    );

    const editButton = screen.getByTestId('edit-retention-period-button');

    act(() => {
      fireEvent.click(editButton);
    });

    expect(screen.getByTestId('retention-period-modal')).toBeInTheDocument();

    expect(screen.getByTestId('retention-period-input')).toHaveValue('23');
  });

  it('Should call onUpdate on submit form', async () => {
    render(<RetentionPeriod {...mockRetentionPeriodProps} />);

    const editButton = screen.getByTestId('edit-retention-period-button');

    act(() => {
      fireEvent.click(editButton);
    });

    expect(screen.getByTestId('retention-period-modal')).toBeInTheDocument();

    const saveButton = screen.getByText('label.save');

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(undefined);
  });

  it('Should call onUpdate with value on submit form', async () => {
    render(<RetentionPeriod {...mockRetentionPeriodProps} />);

    const editButton = screen.getByTestId('edit-retention-period-button');

    act(() => {
      fireEvent.click(editButton);
    });

    expect(screen.getByTestId('retention-period-modal')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('retention-period-input'), {
      target: { value: 12 },
    });

    const saveButton = screen.getByText('label.save');

    await act(async () => {
      fireEvent.click(saveButton);
    });

    // value converted to ISO 8601 duration format
    expect(mockOnUpdate).toHaveBeenCalledWith('P12D');
  });

  it('Should not break component if retention period is not valid ISO 8601 duration', async () => {
    render(
      <RetentionPeriod {...mockRetentionPeriodProps} retentionPeriod="data" />
    );

    expect(
      screen.getByTestId('retention-period-container')
    ).toBeInTheDocument();

    expect(screen.getByText(NO_DATA_PLACEHOLDER)).toBeInTheDocument();
  });

  it('Should call onUpdate handler if provided negative input', async () => {
    render(<RetentionPeriod {...mockRetentionPeriodProps} />);

    const editButton = screen.getByTestId('edit-retention-period-button');

    act(() => {
      fireEvent.click(editButton);
    });

    expect(screen.getByTestId('retention-period-modal')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('retention-period-input'), {
      target: { value: -10 },
    });

    const saveButton = screen.getByText('label.save');

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockOnUpdate).not.toHaveBeenCalled();
  });
});
