/*
 *  Copyright 2024 Collate.
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
import SettingItemCard from './SettingItemCard.component';

const mockData = {
  key: 'test-key',
  icon: () => <svg>Test Icon</svg>,
  category: 'Test Category',
  label: 'Test Label',
  description: 'This is an test description.',
};

const mockOnClick = jest.fn();

describe('SettingItemCard', () => {
  it('should render Setting Item Card', () => {
    render(<SettingItemCard data={mockData} onClick={mockOnClick} />);

    expect(screen.getByText('Test Category')).toBeInTheDocument();
    expect(
      screen.getByText('This is an test description.')
    ).toBeInTheDocument();
  });

  it('should render icon', () => {
    render(<SettingItemCard data={mockData} onClick={mockOnClick} />);

    expect(screen.getByText('Test Icon')).toBeInTheDocument();
  });

  it('should render label in case no category', () => {
    render(
      <SettingItemCard
        data={{ ...mockData, category: undefined }}
        onClick={mockOnClick}
      />
    );

    expect(screen.queryByText('Test Category')).not.toBeInTheDocument();
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('should calls onClick when clicked', () => {
    render(<SettingItemCard data={mockData} onClick={mockOnClick} />);

    fireEvent.click(screen.getByTestId('test-key'));

    expect(mockOnClick).toHaveBeenCalledWith('test-key');
  });
});
