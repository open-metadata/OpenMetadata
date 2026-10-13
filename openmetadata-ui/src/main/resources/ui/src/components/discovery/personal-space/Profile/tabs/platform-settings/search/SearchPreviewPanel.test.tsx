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
import { SearchIndex } from '../../../../../../../enums/search.enum';
import { searchPreview } from '../../../../../../../rest/searchAPI';
import { showErrorToast } from '../../../../../../../utils/ToastUtils';
import SearchPreviewPanel from './SearchPreviewPanel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../../rest/searchAPI', () => ({
  searchPreview: jest.fn(),
}));

jest.mock('../../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock(
  '../../../../../../ExploreV1/ExploreSearchCard/ExploreSearchCard',
  () =>
    ({
      source,
      score,
    }: {
      source: { fullyQualifiedName: string };
      score?: number;
    }) =>
      (
        <div data-testid="preview-result">
          {source.fullyQualifiedName}
          {score !== undefined && ` score:${score}`}
        </div>
      )
);

const CONFIG = { assetTypeConfigurations: [{ assetType: 'table' }] };

const hits = (count: number, total = count) => ({
  hits: {
    hits: Array.from({ length: count }, (_, index) => ({
      _id: String(index),
      _score: 1.5,
      _source: { fullyQualifiedName: `db.schema.t${index}` },
    })),
    total: { value: total },
  },
});

const lastRequest = () => {
  const calls = (searchPreview as jest.Mock).mock.calls;

  return calls[calls.length - 1][0];
};

const renderPanel = async () => {
  render(<SearchPreviewPanel entityType="table" searchConfig={CONFIG} />);
  await act(async () => {
    await Promise.resolve();
  });
};

describe('SearchPreviewPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (searchPreview as jest.Mock).mockResolvedValue(hits(2));
  });

  it('previews the entity index with the given settings', async () => {
    await renderPanel();

    expect(searchPreview).toHaveBeenCalledWith({
      from: 0,
      size: 15,
      index: SearchIndex.TABLE,
      query: '',
      queryFilter: '',
      explain: false,
      searchSettings: CONFIG,
    });
    expect(screen.getAllByTestId('preview-result')).toHaveLength(2);
    expect(
      screen.queryByTestId('search-preview-empty')
    ).not.toBeInTheDocument();
  });

  it('searches once typing settles', async () => {
    await renderPanel();
    fireEvent.change(screen.getByTestId('search-preview-input'), {
      target: { value: 'orders' },
    });

    expect(searchPreview).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(lastRequest().query).toBe('orders');
  });

  it('previews a changed draft once it stops changing', async () => {
    const { rerender } = render(
      <SearchPreviewPanel entityType="table" searchConfig={CONFIG} />
    );
    await act(async () => {
      await Promise.resolve();
    });
    const drafts = [1, 2, 3].map((weight) => ({
      ...CONFIG,
      globalSettings: { semanticWeight: weight / 10 },
    }));
    for (const draft of drafts) {
      rerender(<SearchPreviewPanel entityType="table" searchConfig={draft} />);
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
    }

    expect(searchPreview).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(searchPreview).toHaveBeenCalledTimes(2);
    expect(lastRequest().searchSettings).toBe(drafts[2]);
  });

  it('asks for and shows ranking details when switched on', async () => {
    await renderPanel();
    await act(async () => {
      fireEvent.click(
        screen
          .getByTestId('ranking-details-switch')
          .querySelector('input') as HTMLInputElement
      );
    });

    expect(lastRequest().explain).toBe(true);
    expect(screen.getAllByTestId('preview-result')[0]).toHaveTextContent(
      'score:1.5'
    );
  });

  it('pages through results beyond one page', async () => {
    (searchPreview as jest.Mock).mockResolvedValue(hits(15, 40));
    await renderPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });

    expect(lastRequest().from).toBe(15);
  });

  it('shows an empty state with no results and a toast on failure', async () => {
    (searchPreview as jest.Mock).mockResolvedValue(hits(0));
    await renderPanel();

    expect(screen.getByTestId('search-preview-empty')).toBeInTheDocument();

    (searchPreview as jest.Mock).mockRejectedValue(new Error('boom'));
    fireEvent.change(screen.getByTestId('search-preview-input'), {
      target: { value: 'x' },
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(showErrorToast).toHaveBeenCalled();
  });
});
