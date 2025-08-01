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
import { MemoryRouter } from 'react-router-dom';
import LimitWrapper from '../../../../hoc/LimitWrapper';
import BotListV1 from './BotListV1.component';

const mockHandleAddBotClick = jest.fn();
const mockHandleShowDeleted = jest.fn();

const mockProps = {
  showDeleted: false,
  handleAddBotClick: mockHandleAddBotClick,
  handleShowDeleted: mockHandleShowDeleted,
};

jest.mock('../../../../hoc/LimitWrapper', () => {
  return jest.fn().mockImplementation(() => <>LimitWrapper</>);
});

jest.mock('../../../../utils/StringsUtils', () => ({
  ...jest.requireActual('../../../../utils/StringsUtils'),
  stringToHTML: jest.fn((text) => text),
}));

jest.mock('../../../../utils/EntityUtils', () => ({
  ...jest.requireActual('../../../../utils/EntityUtils'),
  highlightSearchText: jest.fn((text) => text),
  getTitleCase: jest.fn((text) => text.charAt(0).toUpperCase() + text.slice(1)),
}));

describe('BotListV1', () => {
  it('renders the component', () => {
    render(<BotListV1 {...mockProps} />, { wrapper: MemoryRouter });

    expect(screen.getByText('label.show-deleted')).toBeInTheDocument();
  });

  it('handles show deleted', async () => {
    render(<BotListV1 {...mockProps} />, { wrapper: MemoryRouter });
    const showDeletedSwitch = await screen.findByTestId('switch-deleted');
    fireEvent.click(showDeletedSwitch);

    expect(mockHandleShowDeleted).toHaveBeenCalledWith(
      true,
      expect.objectContaining({})
    );
  });

  it('should render LimitWrapper', async () => {
    render(<BotListV1 {...mockProps} />, { wrapper: MemoryRouter });
    const addBotButton = screen.getByText('LimitWrapper');
    fireEvent.click(addBotButton);
    // Add your assertions here

    expect(LimitWrapper).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'bot' }),
      {}
    );
  });
});
