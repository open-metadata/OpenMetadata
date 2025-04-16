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
import { GlobalSettingItem } from './GlobalSettingsItem';

const mockProps = {
  label: 'Max Result Hits',
  value: 10000,
  onUpdate: jest.fn().mockImplementation(() => Promise.resolve()),
};

describe('GlobalSettingItem', () => {
  it('Should render label and value correctly', () => {
    render(<GlobalSettingItem {...mockProps} />);

    expect(screen.getByTestId('global-setting-label')).toHaveTextContent(
      mockProps.label
    );
    expect(
      screen.getByTestId(`global-setting-value-${mockProps.label}`)
    ).toHaveTextContent(mockProps.value.toString());
  });

  it('Should switch to edit mode when edit icon is clicked', () => {
    render(<GlobalSettingItem {...mockProps} />);

    const editIcon = screen.getByTestId(
      `global-setting-edit-icon-${mockProps.label}`
    );
    fireEvent.click(editIcon);

    expect(screen.getByTestId('value-input')).toBeInTheDocument();
  });

  it('Should update value when input changes', () => {
    render(<GlobalSettingItem {...mockProps} />);

    const editIcon = screen.getByTestId(
      `global-setting-edit-icon-${mockProps.label}`
    );
    fireEvent.click(editIcon);

    const input = screen.getByTestId('value-input');
    fireEvent.change(input, { target: { value: '15000' } });

    expect(input).toHaveValue(15000);
  });
});
