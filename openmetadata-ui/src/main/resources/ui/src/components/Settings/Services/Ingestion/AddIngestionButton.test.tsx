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

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { mockIngestionWorkFlow } from '../../../../mocks/Ingestion.mock';
import { mockAddIngestionButtonProps } from '../../../../mocks/IngestionListTable.mock';
import AddIngestionButton from './AddIngestionButton.component';

const mockNavigate = jest.fn();

jest.mock('../../../../hoc/LimitWrapper', () =>
  jest
    .fn()
    .mockImplementation(({ children }) => <div>LimitWrapper{children}</div>)
);

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

describe('AddIngestionButton', () => {
  it('should not redirect to metadata ingestion page when no ingestion is present', async () => {
    await act(async () => {
      render(<AddIngestionButton {...mockAddIngestionButtonProps} />, {
        wrapper: MemoryRouter,
      });
    });
    const addIngestionButton = screen.getByTestId('add-new-ingestion-button');

    fireEvent.click(addIngestionButton);

    expect(mockNavigate).toHaveBeenCalledTimes(0);

    expect(screen.getByTestId('agent-item-metadata')).toBeInTheDocument();
  });

  it('should not redirect to metadata ingestion page when ingestion data is present', async () => {
    await act(async () => {
      render(
        <AddIngestionButton
          {...mockAddIngestionButtonProps}
          ingestionList={mockIngestionWorkFlow.data.data}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });
    const addIngestionButton = screen.getByTestId('add-new-ingestion-button');

    await act(async () => {
      userEvent.click(addIngestionButton);
    });

    expect(mockNavigate).toHaveBeenCalledTimes(0);
  });
});
