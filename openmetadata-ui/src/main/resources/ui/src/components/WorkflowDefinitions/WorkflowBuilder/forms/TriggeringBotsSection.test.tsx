/*
 *  Copyright 2026 Collate.
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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkflowModeProvider } from '../../../../contexts/WorkflowModeContext';
import { ProviderType } from '../../../../generated/entity/bot';
import { getApplicationList } from '../../../../rest/applicationAPI';
import { getMarketPlaceApplicationList } from '../../../../rest/applicationMarketPlaceAPI';
import { getBots } from '../../../../rest/botsAPI';
import { TriggeringBotsSection } from './TriggeringBotsSection';

jest.mock('../../../../rest/botsAPI', () => ({
  getBots: jest.fn(),
}));

jest.mock('../../../../rest/applicationAPI', () => ({
  getApplicationList: jest.fn(),
}));

jest.mock('../../../../rest/applicationMarketPlaceAPI', () => ({
  getMarketPlaceApplicationList: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockGetBots = getBots as jest.Mock;
const mockGetApplicationList = getApplicationList as jest.Mock;
const mockGetMarketPlaceApplicationList =
  getMarketPlaceApplicationList as jest.Mock;

const BOTS = [
  {
    id: 'b1',
    name: 'scraper-bot',
    displayName: 'Scraper',
    provider: ProviderType.User,
  },
  {
    id: 'b2',
    name: 'ingestion-bot',
    displayName: 'Ingestion',
    provider: ProviderType.System,
  },
  {
    id: 'b3',
    name: 'SearchIndexingApplicationBot',
    displayName: 'Search Indexing',
    provider: ProviderType.User,
  },
  {
    id: 'b4',
    name: 'CacheWarmupApplicationBot',
    displayName: 'Cache Warmup',
    provider: ProviderType.User,
  },
];

const renderSection = (
  triggeringBots: string[],
  onTriggeringBotsChange = jest.fn()
) =>
  render(
    <MemoryRouter>
      <WorkflowModeProvider>
        <TriggeringBotsSection
          triggeringBots={triggeringBots}
          onTriggeringBotsChange={onTriggeringBotsChange}
        />
      </WorkflowModeProvider>
    </MemoryRouter>
  );

const typeInCombobox = (text: string) => {
  const combobox = screen.getByRole('combobox');

  act(() => combobox.focus());
  fireEvent.change(combobox, { target: { value: text } });
};

describe('TriggeringBotsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBots.mockResolvedValue({ data: BOTS, paging: { total: 3 } });
    mockGetApplicationList.mockResolvedValue({
      data: [
        { id: 'a1', name: 'SearchIndexingApplication', bot: { id: 'b3' } },
      ],
      paging: { total: 1 },
    });
    mockGetMarketPlaceApplicationList.mockResolvedValue({
      data: [{ name: 'CacheWarmupApplication' }],
      paging: { total: 1 },
    });
  });

  it('offers only the bots an admin created', async () => {
    renderSection([]);

    await waitFor(() => expect(mockGetApplicationList).toHaveBeenCalled());
    typeInCombobox('');

    expect(
      await screen.findByRole('option', { name: 'Scraper' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Ingestion' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Search Indexing' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Cache Warmup' })
    ).not.toBeInTheDocument();
  });

  it('reads every page of bots', async () => {
    mockGetBots
      .mockResolvedValueOnce({ data: [BOTS[1]], paging: { after: 'next' } })
      .mockResolvedValueOnce({ data: [BOTS[0]], paging: {} });
    renderSection([]);

    await waitFor(() => expect(mockGetBots).toHaveBeenCalledTimes(2));

    expect(mockGetBots).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: 'next' })
    );
  });

  it('adds a picked bot to the list', async () => {
    const onChange = jest.fn();
    renderSection([], onChange);

    await waitFor(() => expect(mockGetApplicationList).toHaveBeenCalled());
    typeInCombobox('Scr');
    fireEvent.click(await screen.findByRole('option', { name: 'Scraper' }));

    expect(onChange).toHaveBeenCalledWith(['scraper-bot']);
  });

  it('shows a saved bot by its display name once the bots load', async () => {
    renderSection(['scraper-bot']);

    expect(
      await within(
        await screen.findByTestId('autocomplete-selected-item')
      ).findByText('Scraper')
    ).toBeInTheDocument();
  });

  it('removes a bot from the list', async () => {
    const onChange = jest.fn();
    renderSection(['scraper-bot'], onChange);

    fireEvent.click(
      within(await screen.findByTestId('autocomplete-selected-item')).getByRole(
        'button'
      )
    );

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
