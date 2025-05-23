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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BotsPageV1 from './BotsPageV1.component';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../components/Settings/Bot/BotListV1/BotListV1.component', () =>
  jest
    .fn()
    .mockImplementation(
      ({ handleAddBotClick, handleShowDeleted, showDeleted }) => (
        <>
          <p>{showDeleted ? 'Bot Deleted' : ''}</p>
          <button onClick={handleAddBotClick}>Add Bot</button>
          <button onClick={() => handleShowDeleted(true)}>Delete Bot</button>
        </>
      )
    )
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn(({ children }) => <div>{children}</div>)
);

describe('BotsPageV1 component', () => {
  it('Add bot should call mockPush', async () => {
    render(<BotsPageV1 />);

    userEvent.click(screen.getByRole('button', { name: 'Add Bot' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
  });

  it('Bot deleted should not present by default', () => {
    render(<BotsPageV1 />);

    expect(screen.queryByText('Bot Deleted')).not.toBeInTheDocument();
  });

  it('Delete Bot button should delete bot', async () => {
    render(<BotsPageV1 />);

    expect(screen.queryByText('Bot Deleted')).not.toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Delete Bot' }));

    expect(await screen.findByText('Bot Deleted')).toBeInTheDocument();
  });
});
