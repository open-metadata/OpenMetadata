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
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PageViewMode } from '../../generated/type/personaPreferences';
import {
  getLearningResourceById,
  getLearningResourcesList,
  LearningResource,
} from '../../rest/learningResourceAPI';
import { LearningResourcesPage } from './LearningResourcesPage';

const mockResource: LearningResource = {
  id: 'resource-1',
  name: 'CollateCluesAutomations',
  displayName: 'Collate Clues: Automations',
  resourceType: 'Video',
  categories: ['Discovery'],
  source: { url: 'https://www.youtube.com/watch?v=abc' },
  contexts: [{ pageId: 'glossary' }],
  status: 'Active',
};

jest.mock('../../rest/learningResourceAPI', () => ({
  getLearningResourcesList: jest.fn(),
  getLearningResourceById: jest.fn(),
  deleteLearningResource: jest.fn(),
}));

jest.mock('../../hooks/platform/usePersonaViewMode', () => ({
  usePersonaViewMode: jest.fn().mockReturnValue('table'),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ))
);

const mockGetList = getLearningResourcesList as jest.Mock;

const lastListParams = () => mockGetList.mock.calls.at(-1)?.[0];

const renderPage = async () => {
  render(
    <MemoryRouter>
      <LearningResourcesPage />
    </MemoryRouter>
  );

  await screen.findByText('Collate Clues: Automations');
};

const applyFilter = async (searchKey: string, optionKey: string) => {
  fireEvent.click(screen.getByTestId(`search-dropdown-${searchKey}`));
  fireEvent.click(await screen.findByTestId(optionKey));
  fireEvent.click(screen.getByTestId('update-btn'));
};

describe('LearningResourcesPage', () => {
  beforeEach(() => {
    mockGetList.mockResolvedValue({
      data: [mockResource],
      paging: { total: 1 },
    });
    (getLearningResourceById as jest.Mock).mockResolvedValue(mockResource);
  });

  it('should open the resource player on row click and close it', async () => {
    await renderPage();

    fireEvent.click(screen.getByText('Collate Clues: Automations'));

    const dialog = await screen.findByTestId('resource-player-dialog');

    expect(
      within(dialog).getByText('Collate Clues: Automations')
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByTestId('close-resource-player'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('resource-player-dialog')
      ).not.toBeInTheDocument()
    );
  });

  it('should toggle between table and card views', async () => {
    await renderPage();

    expect(
      screen.getByTestId('learning-resources-table-body')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`${PageViewMode.Card}-view-toggle`));

    expect(
      screen.queryByTestId('learning-resources-table-body')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId(`learning-resource-card-${mockResource.name}`)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`${PageViewMode.Table}-view-toggle`));

    expect(
      screen.getByTestId('learning-resources-table-body')
    ).toBeInTheDocument();
  });

  it('should send the search term to the list API', async () => {
    await renderPage();

    fireEvent.change(screen.getByPlaceholderText('label.search-entity'), {
      target: { value: 'automations' },
    });

    await waitFor(() =>
      expect(lastListParams()).toEqual(
        expect.objectContaining({ search: 'automations' })
      )
    );
  });

  it.each([
    ['type', 'Video', 'resourceType', 'Video'],
    ['category', 'Discovery', 'category', 'Discovery'],
    ['context', 'glossary', 'pageId', 'Glossary'],
    ['status', 'Active', 'status', 'Active'],
  ])(
    'should filter by %s with the %s param and show its chip',
    async (searchKey, optionKey, param, chipLabel) => {
      await renderPage();

      await applyFilter(searchKey, optionKey);

      await waitFor(() =>
        expect(lastListParams()).toEqual(
          expect.objectContaining({ [param]: [optionKey] })
        )
      );

      expect(screen.getByTestId(`filter-chip-${searchKey}`)).toHaveTextContent(
        chipLabel
      );
    }
  );

  it('should clear all filters and re-fetch without filter params', async () => {
    await renderPage();

    await applyFilter('type', 'Video');

    await screen.findByTestId('filter-chip-type');
    mockGetList.mockClear();

    fireEvent.click(screen.getByText('label.clear-entity'));

    await waitFor(() => expect(mockGetList).toHaveBeenCalled());

    const params = lastListParams();

    expect(params.resourceType).toBeUndefined();
    expect(params.category).toBeUndefined();
    expect(params.pageId).toBeUndefined();
    expect(params.status).toBeUndefined();
    expect(params.search).toBeUndefined();
    expect(screen.queryByTestId('filter-chip-type')).not.toBeInTheDocument();
  });
});
