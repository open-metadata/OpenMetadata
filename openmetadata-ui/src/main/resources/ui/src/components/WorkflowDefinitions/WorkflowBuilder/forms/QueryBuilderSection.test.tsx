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
import { render, screen, waitFor } from '@testing-library/react';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { SearchOutputType } from '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { QueryBuilderSection } from './QueryBuilderSection';

// This section is the entry point for the workflow builder's Check Condition,
// Event Trigger Filter and Data Asset Filters — three screens that reported
// rendering an empty box. It had no test at all, which is how that shipped.

const advanceSearchContext = {
  toggleModal: jest.fn(),
  sqlQuery: '',
  onResetAllFilters: jest.fn(),
  onChangeSearchIndex: jest.fn(),
  isUpdating: false,
  // The provider resolves EntityType.ALL to the DATA_ASSET index.
  searchIndex: SearchIndex.DATA_ASSET,
  config: { fields: { owners: { label: 'Owners', type: 'select' } } },
};

jest.mock(
  '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    AdvanceSearchProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    useAdvanceSearch: jest.fn(() => advanceSearchContext),
  })
);

jest.mock('../../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityTypeSearchIndexMapping: jest.fn(() => ({
      all: 'all',
      table: 'table',
    })),
  },
}));

jest.mock('../../../../contexts/WorkflowModeContext', () => ({
  useWorkflowModeContext: jest.fn(() => ({ isViewMode: false })),
}));

const queryBuilderProps = jest.fn();
jest.mock('../../../common/QueryBuilder/QueryBuilder', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    queryBuilderProps(props);

    return <div data-testid="query-builder-form-field" />;
  },
}));

jest.mock('react-router-dom', () => ({ useLocation: jest.fn() }));

const renderSection = (overrides = {}) =>
  render(<QueryBuilderSection value="" onChange={jest.fn()} {...overrides} />);

const lastProps = () => queryBuilderProps.mock.calls.at(-1)?.[0];

describe('QueryBuilderSection', () => {
  beforeEach(() => {
    advanceSearchContext.isUpdating = false;
    advanceSearchContext.searchIndex = SearchIndex.DATA_ASSET;
    advanceSearchContext.config = {
      fields: { owners: { label: 'Owners', type: 'select' } },
    };
  });

  it('should render a builder rather than an empty container', async () => {
    renderSection();

    await waitFor(() =>
      expect(screen.getByTestId('query-builder-section')).toBeInTheDocument()
    );

    expect(screen.getByTestId('query-builder-form-field')).toBeInTheDocument();
  });

  it('should hand the builder a non-empty field set', async () => {
    renderSection();

    await waitFor(() => expect(queryBuilderProps).toHaveBeenCalled());

    // An empty `{}` survives `??`, so a provider that has not loaded its fields
    // yet would render a builder with nothing selectable — which reads as an
    // empty box.
    expect(Object.keys(lastProps().fields ?? {}).length).toBeGreaterThan(0);
  });

  it('should render for JSONLogic output too', async () => {
    renderSection({ outputType: SearchOutputType.JSONLogic });

    await waitFor(() => expect(queryBuilderProps).toHaveBeenCalled());

    expect(lastProps().outputType).toBe(SearchOutputType.JSONLogic);
    expect(screen.getByTestId('query-builder-form-field')).toBeInTheDocument();
  });

  it('should stay read-only in view mode without hiding the builder', async () => {
    const { useWorkflowModeContext } = jest.requireMock(
      '../../../../contexts/WorkflowModeContext'
    );
    useWorkflowModeContext.mockReturnValueOnce({ isViewMode: true });

    renderSection();

    await waitFor(() => expect(queryBuilderProps).toHaveBeenCalled());

    expect(screen.getByTestId('query-builder-form-field')).toBeInTheDocument();
  });

  it('should forward the entity type it is configured with', async () => {
    // The adapter waits for the provider to be on this entity's index.
    advanceSearchContext.searchIndex = SearchIndex.TABLE;
    renderSection({ entityTypes: EntityType.TABLE });

    await waitFor(() => expect(queryBuilderProps).toHaveBeenCalled());

    expect(lastProps().entityType).toBe(EntityType.TABLE);
  });

  // This is the failure mode behind the "empty box" reports: the adapter
  // renders nothing at all until the provider's search index matches the one
  // this section asked for. If the provider never settles on that index — a
  // failed field load, an index the provider does not switch to — the section
  // stays blank forever with no loader and no error.
  it('should render nothing while the provider is on a different index', () => {
    advanceSearchContext.searchIndex = SearchIndex.DASHBOARD;
    renderSection({ entityTypes: EntityType.TABLE });

    expect(
      screen.queryByTestId('query-builder-form-field')
    ).not.toBeInTheDocument();
  });

  it('should render nothing while the provider is still updating', () => {
    advanceSearchContext.isUpdating = true;
    renderSection();

    expect(
      screen.queryByTestId('query-builder-form-field')
    ).not.toBeInTheDocument();
  });
});
