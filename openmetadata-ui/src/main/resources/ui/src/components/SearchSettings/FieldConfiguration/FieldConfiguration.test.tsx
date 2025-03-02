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
import { MatchType } from '../../../pages/SearchSettingsPage/searchSettings.interface';
import FieldConfiguration from './FieldConfiguration';

const mockProps = {
  field: {
    fieldName: 'description',
    weight: 5,
  },
  index: 0,
  searchSettings: {
    highlightFields: ['description'],
    fields: { description: 5 },
    mustMatch: ['description'],
    shouldMatch: [],
    mustNotMatch: [],
    boosts: [],
  },
  onHighlightFieldsChange: jest.fn(),
  onMatchTypeChange: jest.fn(),
  onFieldWeightChange: jest.fn(),
  onBoostChange: jest.fn(),
  onDeleteBoost: jest.fn(),
  getSelectedMatchType: jest.fn().mockReturnValue('mustMatch'),
};

jest.mock('../AddBoost/AddBoost', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="add-boost-component" />);
});

describe('FieldConfiguration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should render field name and weight correctly', () => {
    render(<FieldConfiguration {...mockProps} />);

    expect(screen.getByTestId('field-name')).toHaveTextContent(
      mockProps.field.fieldName
    );
    expect(screen.getByTestId('field-weight')).toHaveTextContent(
      mockProps.field.weight.toString()
    );
  });

  it('Should handle highlight fields toggle', () => {
    render(<FieldConfiguration {...mockProps} />);

    fireEvent.click(screen.getByTestId('field-container-header'));

    const highlightSwitch = screen.getByTestId('highlight-field-switch');
    fireEvent.click(highlightSwitch);

    expect(mockProps.onHighlightFieldsChange).toHaveBeenCalledWith(
      mockProps.field.fieldName
    );
  });

  it('Should handle match type change', () => {
    render(<FieldConfiguration {...mockProps} />);

    fireEvent.click(screen.getByTestId('field-container-header'));

    const shouldMatchRadio = screen.getByTestId('should-match-radio');
    fireEvent.click(shouldMatchRadio);

    expect(mockProps.onMatchTypeChange).toHaveBeenCalledWith(
      mockProps.field.fieldName,
      'shouldMatch' as MatchType
    );
  });

  it('Should handle weight slider change', () => {
    render(<FieldConfiguration {...mockProps} />);

    fireEvent.click(screen.getByTestId('field-container-header'));

    const slider = screen.getByRole('slider');
    fireEvent.mouseDown(slider);
    fireEvent.mouseMove(slider, { clientX: 200 });
    fireEvent.mouseUp(slider);

    expect(mockProps.onFieldWeightChange).toHaveBeenCalledWith(
      mockProps.field.fieldName,
      10
    );
  });

  it('Should handle add boost dropdown', () => {
    render(<FieldConfiguration {...mockProps} />);

    fireEvent.click(screen.getByTestId('field-container-header'));

    const addBoostButton = screen.getByTestId('add-boost');
    fireEvent.click(addBoostButton);

    const valueBoostOption = screen.getByTestId('value-boost-option');
    fireEvent.click(valueBoostOption);

    expect(screen.getByTestId('add-boost-component')).toBeInTheDocument();
  });
});
