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
import React from 'react';
import { Modifier } from '../../../generated/configuration/searchSettings';
import AddBoost from './AddBoost';

const mockProps = {
  fieldValueBoosts: [
    {
      field: 'name',
      factor: 5,
      modifier: Modifier.None,
      missing: 0,
      condition: { range: {} },
    },
  ],
  fieldName: 'name',
  onValueBoostChange: jest.fn(),
  onDeleteBoost: jest.fn(),
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (str: string) => str,
  }),
}));

describe('AddBoost Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should render the component with correct initial values', () => {
    render(<AddBoost {...mockProps} />);

    expect(screen.getByTestId('boost-label')).toBeInTheDocument();
    expect(screen.getByTestId('field-boost-value')).toBeInTheDocument();
    expect(screen.getByTestId('delete-boost-btn')).toBeInTheDocument();

    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(screen.getByTestId('modifier-select')).toBeInTheDocument();
    expect(screen.getByTestId('missing-value-input')).toBeInTheDocument();
    expect(screen.getByTestId('range-condition-label')).toBeInTheDocument();
  });

  it('Should handle slider value changes', () => {
    render(<AddBoost {...mockProps} />);

    const slider = screen.getByRole('slider');

    fireEvent.mouseDown(slider);
    fireEvent.mouseMove(slider, { clientX: 200 });
    fireEvent.mouseUp(slider);

    expect(mockProps.onValueBoostChange).toHaveBeenCalled();
  });

  it('Should handle missing value changes', () => {
    render(<AddBoost {...mockProps} />);

    const missingInput = screen.getByTestId('missing-value-input');
    fireEvent.change(missingInput, { target: { value: '2' } });

    expect(mockProps.onValueBoostChange).toHaveBeenCalledWith(
      'name',
      expect.objectContaining({
        missing: 2,
      })
    );
  });

  it('Should handle range condition changes', () => {
    render(<AddBoost {...mockProps} />);

    const gteInput = screen.getByTestId('gte-input');

    fireEvent.change(gteInput, { target: { value: '1' } });

    expect(mockProps.onValueBoostChange).toHaveBeenCalledWith(
      'name',
      expect.objectContaining({
        condition: { range: { gte: 1 } },
      })
    );
  });

  it('Should handle delete button click', () => {
    render(<AddBoost {...mockProps} />);

    const deleteButton = screen.getByTestId('delete-boost-btn');
    fireEvent.click(deleteButton);

    expect(mockProps.onDeleteBoost).toHaveBeenCalledWith('name');
  });
});
