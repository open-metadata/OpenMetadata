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
import CollapseHeader from './CollapseHeader';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

describe('CollapseHeader Component', () => {
  const mockTitle = 'Test Header';
  const mockDataTestId = 'test-collapse-header';
  const mockHandleAddNewBoost = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component with title and add button', () => {
    render(
      <CollapseHeader
        dataTestId={mockDataTestId}
        handleAddNewBoost={mockHandleAddNewBoost}
        title={mockTitle}
      />
    );

    // Check if title is rendered
    expect(screen.getByText(mockTitle)).toBeInTheDocument();

    // Check if add button is rendered
    const addButton = screen.getByTestId(mockDataTestId);

    expect(addButton).toBeInTheDocument();
    expect(screen.getByText('label.add')).toBeInTheDocument();
  });

  it('should call handleAddNewBoost when add button is clicked', () => {
    render(
      <CollapseHeader
        dataTestId={mockDataTestId}
        handleAddNewBoost={mockHandleAddNewBoost}
        title={mockTitle}
      />
    );

    const addButton = screen.getByTestId(mockDataTestId);
    fireEvent.click(addButton);

    // Check if handleAddNewBoost is called
    expect(mockHandleAddNewBoost).toHaveBeenCalledTimes(1);
  });
});
