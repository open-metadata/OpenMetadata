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
import { FieldValueBoost } from '../../../generated/configuration/searchSettings';
import { MatchType } from '../../../generated/settings/settings';
import FieldConfiguration from './FieldConfiguration';

const mockProps = {
  field: {
    fieldName: 'description',
    weight: 5,
    matchType: MatchType.Exact,
  },
  index: 0,
  searchSettings: {
    highlightFields: ['description'],
    fields: { description: 5 },
    fieldValueBoosts: [] as FieldValueBoost[],
  },
  onHighlightFieldsChange: jest.fn(),
  onFieldWeightChange: jest.fn(),
  onDeleteSearchField: jest.fn(),
  onMatchTypeChange: jest.fn(),
  entityFields: [],
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (str: string) => str,
  }),
}));

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
      `0${mockProps.field.weight}`
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

  it('Should handle weight slider change', () => {
    render(<FieldConfiguration {...mockProps} />);

    fireEvent.click(screen.getByTestId('field-container-header'));

    const slider = screen.getByRole('slider');
    fireEvent.mouseDown(slider);
    fireEvent.mouseMove(slider, { clientX: 200 });
    fireEvent.mouseUp(slider);

    expect(mockProps.onFieldWeightChange).toHaveBeenCalled();
  });

  it('Should handle delete search field', () => {
    render(<FieldConfiguration {...mockProps} />);

    fireEvent.click(screen.getByTestId('field-container-header'));

    const deleteButton = screen.getByTestId('delete-search-field');
    fireEvent.click(deleteButton);

    expect(mockProps.onDeleteSearchField).toHaveBeenCalled();
  });
});
