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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { getMarketPlaceApplicationList } from '../../../../../../rest/applicationMarketPlaceAPI';
import MarketplaceList from './MarketplaceList';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../rest/applicationMarketPlaceAPI', () => ({
  getMarketPlaceApplicationList: jest.fn(),
}));

const onNavigate = jest.fn();
const onHeaderChange = jest.fn();

describe('MarketplaceList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMarketPlaceApplicationList as jest.Mock).mockResolvedValue({
      data: [
        {
          id: '1',
          name: 'RdfIndexApp',
          fullyQualifiedName: 'RdfIndexApp',
          displayName: 'RDF Knowledge Graph Indexing',
          description: 'Index catalog metadata as RDF triples.',
        },
      ],
      paging: { total: 1 },
    });
  });

  it('renders marketplace cards and names the view in the header', async () => {
    const { container } = render(
      <MarketplaceList
        onHeaderChange={onHeaderChange}
        onNavigate={onNavigate}
      />
    );
    await act(async () => undefined);

    expect(screen.getByText('RDF Knowledge Graph Indexing')).toBeVisible();
    expect(onHeaderChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'label.market-place' })
    );
    expect(container.querySelector('[class*="ant-"]')).toBeNull();
  });

  it('opens the marketplace detail on card click', async () => {
    render(
      <MarketplaceList
        onHeaderChange={onHeaderChange}
        onNavigate={onNavigate}
      />
    );
    await act(async () => undefined);

    fireEvent.click(screen.getByTestId('rdf-index-app-card'));

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'marketplace-detail',
      fqn: 'RdfIndexApp',
    });
  });
});
