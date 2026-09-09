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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchOutputType } from '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import QueryBuilder from '../QueryBuilder';

// setupTests.js globally stubs `advancedSearchClassBase.getQbConfigs` to `{}`.
jest.mock('../../../../utils/AdvancedSearchClassBase', () =>
  jest.requireActual('../../../../utils/AdvancedSearchClassBase')
);

jest.mock('../../../../rest/searchAPI', () => ({ searchQuery: jest.fn() }));

jest.mock('../../../../utils/RouterUtils', () => ({
  getExplorePath: jest.fn(),
}));

// The connector's own control is react-aria, which cannot open its listbox
// under jsdom. Standing in for it here isolates the question this file asks:
// when the connector reports a conjunction, does the canvas apply it to the
// node that actually combines the cards?
jest.mock('./QueryBuilderGroupConnector', () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (next: string) => void }) => (
    <button
      data-testid="connector-stub"
      type="button"
      onClick={() => onChange('OR')}>
      connector
    </button>
  ),
}));

// `Add group` opens a react-aria menu, which cannot be opened under jsdom.
// Standing in for it keeps these tests about the canvas: the stub exposes the
// same testid plus one button per conjunction, so a test can add a group and
// say which conjunction joins it.
jest.mock('./QueryBuilderAddGroup', () => ({
  __esModule: true,
  default: ({
    conjunctions,
    testId,
    onAdd,
  }: {
    conjunctions: string[];
    testId: string;
    onAdd: (conjunction?: string) => void;
  }) => (
    <div data-testid={testId}>
      {conjunctions.map((conjunction) => (
        <button
          data-testid={`${testId}-${conjunction.toLowerCase()}`}
          key={conjunction}
          type="button"
          onClick={() => onAdd(conjunction)}>
          {conjunction}
        </button>
      ))}
    </div>
  ),
}));

const { searchQuery } = jest.requireMock('../../../../rest/searchAPI');
const { getExplorePath } = jest.requireMock('../../../../utils/RouterUtils');

beforeEach(() => {
  searchQuery.mockResolvedValue({ hits: { total: { value: 3 } } });
  getExplorePath.mockReturnValue('/explore?');
});

/** Adds a peer group, saying which conjunction joins it. */
const addGroup = (conjunction = 'AND') =>
  fireEvent.click(
    screen.getByTestId(`advanced-search-add-group-${conjunction.toLowerCase()}`)
  );

describe('QueryBuilderCanvas – connector wiring', () => {
  it('should apply the picked conjunction to the node that combines the cards', async () => {
    const onChange = jest.fn();
    render(
      <QueryBuilder
        entityType={EntityType.TABLE}
        groupMode="nested"
        outputType={SearchOutputType.ElasticSearch}
        onChange={onChange}
      />
    );

    addGroup();

    await waitFor(() =>
      expect(screen.getByTestId('connector-stub')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('connector-stub'));

    await waitFor(() => {
      const tree = onChange.mock.calls.at(-1)?.[1] as
        | { properties?: { conjunction?: string } }
        | undefined;

      // The root, not either card: the cards keep their own conjunctions.
      expect(tree?.properties?.conjunction).toBe('OR');
    });
  });

  it('should join a new group by the conjunction picked when adding it', async () => {
    const onChange = jest.fn();
    render(
      <QueryBuilder
        entityType={EntityType.TABLE}
        groupMode="nested"
        outputType={SearchOutputType.ElasticSearch}
        onChange={onChange}
      />
    );

    addGroup('OR');

    await waitFor(() => {
      const tree = onChange.mock.calls.at(-1)?.[1] as
        | { properties?: { conjunction?: string } }
        | undefined;

      expect(tree?.properties?.conjunction).toBe('OR');
    });
  });
});
