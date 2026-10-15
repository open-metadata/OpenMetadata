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
import type {
  Fields,
  SelectWidgetProps,
} from '@react-awesome-query-builder/ui';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { EntityFields } from '../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../enums/search.enum';
import { EntityStatus } from '../../generated/entity/data/searchIndex';
import { getEntityLifecycleStages } from '../../rest/metadataTypeAPI';
import { getAggregateFieldOptions } from '../../rest/miscAPI';
import { AdvancedSearchClassBase } from '../AdvancedSearchClassBase';
import OMSelectWidget from './OMSelectWidget';

// Unlike OMSelectWidget.test.tsx this suite renders the real core ComboBox and
// the real field configs, mocking only the REST clients the fields read from.
jest.mock('../../rest/miscAPI', () => ({
  getAggregateFieldOptions: jest.fn(),
}));

jest.mock('../../rest/metadataTypeAPI', () => ({
  getEntityLifecycleStages: jest.fn(),
}));

const AUTOCOMPLETE_DEBOUNCE_MS = 300;

const dataAssetFields = new AdvancedSearchClassBase().getQueryBuilderFields({
  entitySearchIndex: [SearchIndex.DATA_ASSET],
}) as Fields;

const asyncFetchOf = (fieldKey: string) => {
  const field = dataAssetFields[fieldKey];
  const settings = field && 'fieldSettings' in field && field.fieldSettings;
  const asyncFetch =
    settings && 'asyncFetch' in settings ? settings.asyncFetch : undefined;
  if (typeof asyncFetch !== 'function') {
    throw new Error(`${fieldKey} must load its options asynchronously`);
  }

  return asyncFetch;
};

const renderWidget = (fieldKey: string) =>
  render(
    <OMSelectWidget
      {...({
        asyncFetch: asyncFetchOf(fieldKey),
        config: {},
        field: fieldKey,
        fieldDefinition: {},
        fieldSrc: 'value',
        operator: 'select_equals',
        placeholder: 'Select value',
        readonly: false,
        setValue: jest.fn(),
        useAsyncSearch: true,
        value: null,
        widgetId: 'test',
      } as unknown as SelectWidgetProps)}
    />
  );

const flushDebouncedRequest = async () => {
  await act(async () => {
    jest.advanceTimersByTime(AUTOCOMPLETE_DEBOUNCE_MS);
  });
};

describe('OMSelectWidget with real field configs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the popup open on the empty state for a search with no matches, without re-requesting', async () => {
    (getAggregateFieldOptions as jest.Mock).mockImplementation(
      (_index, field: string, search: string) =>
        Promise.resolve({
          data: {
            aggregations: {
              [`sterms#${field}`]: {
                buckets: search ? [] : [{ key: 'shop_db', doc_count: 1 }],
              },
            },
          },
        })
    );
    renderWidget(EntityFields.DATABASE);
    await flushDebouncedRequest();

    const input = screen.getByRole('combobox');
    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'non-existing-value' } });
    await flushDebouncedRequest();

    expect(await screen.findByRole('listbox')).toHaveTextContent(
      'label.no-data-found'
    );

    await act(async () => {
      jest.advanceTimersByTime(AUTOCOMPLETE_DEBOUNCE_MS * 10);
    });

    expect(screen.getByRole('listbox')).toHaveTextContent(
      'label.no-data-found'
    );
    expect(
      (getAggregateFieldOptions as jest.Mock).mock.calls.map(
        ([, , search]) => search
      )
    ).toEqual(['', 'non-existing-value']);
  });

  it('offers every lifecycle status for the Status field', async () => {
    const statuses = Object.values(EntityStatus);
    (getEntityLifecycleStages as jest.Mock).mockResolvedValue({
      stages: statuses,
      entityTypes: [
        {
          entityType: 'table',
          stages: statuses,
          transitions: [],
          stageWorkflows: [],
        },
      ],
    });
    renderWidget(EntityFields.ENTITY_STATUS);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => screen.getByRole('combobox').focus());

    const listbox = await screen.findByRole('listbox');

    expect(
      within(listbox)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual([...statuses].sort());
  });
});
