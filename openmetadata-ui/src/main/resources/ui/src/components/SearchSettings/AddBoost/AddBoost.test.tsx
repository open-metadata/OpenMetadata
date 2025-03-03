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
import AddBoost from './AddBoost';

const mockProps = {
  boosts: [
    { field: 'name', boost: 5 },
    { field: 'displayName', boost: 3 },
  ],
  fieldName: 'name',
  onBoostChange: jest.fn(),
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

    expect(screen.getByTestId('field-boost-value')).toHaveTextContent('5');

    expect(screen.getByTestId('delete-boost-btn')).toBeInTheDocument();
  });

  it('Should handle slider value changes', () => {
    render(<AddBoost {...mockProps} />);

    const slider = screen.getByRole('slider');

    fireEvent.mouseDown(slider);
    fireEvent.mouseMove(slider, { clientX: 200 });
    fireEvent.mouseUp(slider);

    expect(mockProps.onBoostChange).toHaveBeenCalled();
  });

  it('Should handle delete button click', () => {
    render(<AddBoost {...mockProps} />);

    const deleteButton = screen.getByTestId('delete-boost-btn');
    fireEvent.click(deleteButton);

    expect(mockProps.onDeleteBoost).toHaveBeenCalledWith('name');
  });
});
