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
import {
  FieldValueBoost,
  Modifier,
} from '../../../generated/configuration/searchSettings';
import FieldValueBoostList from './FieldValueBoostList';

const mockFieldValueBoosts: FieldValueBoost[] = [
  {
    field: 'description',
    factor: 6,
    modifier: Modifier.Log1P,
    missing: 0,
    condition: {
      range: {
        gte: 5,
        lte: 10,
      },
    },
  },
  {
    field: 'displayName',
    factor: 20,
    modifier: Modifier.Log2P,
    missing: 1,
    condition: {
      range: {
        gt: 2,
        lt: 8,
      },
    },
  },
];

const mockProps = {
  fieldValueBoosts: mockFieldValueBoosts,
  isLoading: false,
  dataTestId: 'field-value-boost-list',
  handleEditFieldValueBoost: jest.fn(),
  handleDeleteFieldValueBoost: jest.fn(),
};

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

describe('FieldValueBoostList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component with field value boosts', () => {
    render(<FieldValueBoostList {...mockProps} />);

    const table = screen.getByTestId('field-value-boost-list');

    expect(table).toBeInTheDocument();

    expect(screen.getByText('label.field')).toBeInTheDocument();
    expect(screen.getByText('label.factor')).toBeInTheDocument();
    expect(screen.getByText('label.modifier')).toBeInTheDocument();
    expect(screen.getByText('label.missing-value')).toBeInTheDocument();
    expect(screen.getByText('label.greater-than')).toBeInTheDocument();
    expect(
      screen.getByText('label.greater-than-or-equal-to')
    ).toBeInTheDocument();
    expect(screen.getByText('label.less-than')).toBeInTheDocument();
    expect(screen.getByText('label.less-than-or-equal-to')).toBeInTheDocument();
    expect(screen.getByText('label.action-plural')).toBeInTheDocument();

    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getByText('displayName')).toBeInTheDocument();

    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();

    expect(screen.getByText(Modifier.Log1P)).toBeInTheDocument();
    expect(screen.getByText(Modifier.Log2P)).toBeInTheDocument();

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();

    expect(screen.getAllByTestId('edit-field-value-boost-btn')).toHaveLength(2);
    expect(screen.getAllByTestId('delete-field-value-boost-btn')).toHaveLength(
      2
    );
  });

  it('should call handleEditFieldValueBoost when edit button is clicked', () => {
    render(<FieldValueBoostList {...mockProps} />);

    const editButtons = screen.getAllByTestId('edit-field-value-boost-btn');
    fireEvent.click(editButtons[0]);

    expect(mockProps.handleEditFieldValueBoost).toHaveBeenCalled();
  });

  it('should call handleDeleteFieldValueBoost when delete button is clicked', () => {
    render(<FieldValueBoostList {...mockProps} />);

    const deleteButtons = screen.getAllByTestId('delete-field-value-boost-btn');
    fireEvent.click(deleteButtons[0]);

    expect(mockProps.handleDeleteFieldValueBoost).toHaveBeenCalled();
  });

  it('should render in entity search settings mode correctly', () => {
    render(<FieldValueBoostList {...mockProps} entitySearchSettingsPage />);

    expect(screen.queryByText('label.modifier')).not.toBeInTheDocument();
    expect(screen.queryByText('label.missing-value')).not.toBeInTheDocument();
    expect(screen.queryByText('label.greater-than')).not.toBeInTheDocument();

    expect(screen.getByText('label.field')).toBeInTheDocument();
    expect(screen.queryByText('label.factor')).toBeInTheDocument();
    expect(screen.getByText('label.action-plural')).toBeInTheDocument();

    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getByText('displayName')).toBeInTheDocument();

    expect(screen.getAllByTestId('edit-field-value-boost-btn')).toHaveLength(2);
    expect(screen.getAllByTestId('delete-field-value-boost-btn')).toHaveLength(
      2
    );
  });
});
