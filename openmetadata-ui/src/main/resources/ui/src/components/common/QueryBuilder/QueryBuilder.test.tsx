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
import { EntityType } from '../../../enums/entity.enum';
import { SearchOutputType } from '../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import QueryBuilder from './QueryBuilder';

// setupTests.js globally stubs `advancedSearchClassBase.getQbConfigs` to `{}`.
// This suite renders a real builder, so it needs the real config.
jest.mock('../../../utils/AdvancedSearchClassBase', () =>
  jest.requireActual('../../../utils/AdvancedSearchClassBase')
);

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getExplorePath: jest.fn(),
}));

const { searchQuery } = jest.requireMock('../../../rest/searchAPI');
const { getExplorePath } = jest.requireMock('../../../utils/RouterUtils');

// jest.config sets `clearMocks: true`, which strips implementations declared in
// a module factory after the first test that runs. Re-arm them each time.
beforeEach(() => {
  searchQuery.mockResolvedValue({ hits: { total: { value: 42 } } });
  getExplorePath.mockReturnValue('/explore?');
});

const renderBuilder = (props = {}) =>
  render(
    <QueryBuilder
      entityType={EntityType.TABLE}
      outputType={SearchOutputType.ElasticSearch}
      {...props}
    />
  );

describe('QueryBuilder', () => {
  it('should render the builder', () => {
    renderBuilder();

    expect(screen.getByTestId('query-builder-form-field')).toBeInTheDocument();
  });

  describe('groupMode', () => {
    it('should not offer an add-group affordance in flat mode', () => {
      renderBuilder({ groupMode: 'flat' });

      expect(
        screen.queryByTestId('advanced-search-add-group')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('add-group-condition-button')
      ).not.toBeInTheDocument();
    });

    it('should offer an add-group affordance in nested mode', () => {
      renderBuilder({ groupMode: 'nested' });

      expect(
        screen.getAllByTestId('advanced-search-add-group').length
      ).toBeGreaterThan(0);
    });

    it('should still render a JSONLogic rule_group in flat mode', () => {
      // The seeded JSONLogic tree is group -> rule_group(some) -> rule. If
      // flat mode were implemented as a depth cap this would render nothing.
      const { container } = renderBuilder({
        groupMode: 'flat',
        outputType: SearchOutputType.JSONLogic,
      });

      expect(container.querySelector('.rule_group')).toBeInTheDocument();
    });
  });

  describe('delete affordances', () => {
    it('should hide the delete button while a single rule remains', () => {
      renderBuilder({ groupMode: 'flat' });

      expect(
        screen.queryByTestId('delete-condition-button')
      ).not.toBeInTheDocument();
    });

    it('should show delete buttons once a second rule is added', async () => {
      renderBuilder({ groupMode: 'flat' });

      fireEvent.click(screen.getByTestId('add-condition-button'));

      await waitFor(() =>
        expect(
          screen.getAllByTestId('delete-condition-button').length
        ).toBeGreaterThan(0)
      );
    });
  });

  describe('readonly', () => {
    it('should offer neither add nor delete', () => {
      renderBuilder({ groupMode: 'flat', readonly: true });

      expect(
        screen.queryByTestId('add-condition-button')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('delete-condition-button')
      ).not.toBeInTheDocument();
    });
  });

  describe('outputs', () => {
    it('should hand the caller the actions so it can drive add from its own chrome', () => {
      const onActionsReady = jest.fn();
      renderBuilder({ onActionsReady });

      expect(onActionsReady).toHaveBeenCalled();
      expect(typeof onActionsReady.mock.calls[0][0].addRule).toBe('function');
    });

    it('should report an unfinished rule as invalid', async () => {
      const onValidityChange = jest.fn();
      renderBuilder({ groupMode: 'flat', onValidityChange });

      fireEvent.click(screen.getByTestId('add-condition-button'));

      await waitFor(() => expect(onValidityChange).toHaveBeenCalled());

      expect(onValidityChange).toHaveBeenLastCalledWith(false);
    });

    it('should emit a value, a tree and meta on change', async () => {
      const onChange = jest.fn();
      renderBuilder({ groupMode: 'flat', onChange });

      fireEvent.click(screen.getByTestId('add-condition-button'));

      await waitFor(() => expect(onChange).toHaveBeenCalled());

      const [, tree, meta] = onChange.mock.calls.at(-1) ?? [];

      expect(tree).toBeDefined();
      expect(meta?.outputType).toBe(SearchOutputType.ElasticSearch);
    });
  });

  describe('count preview', () => {
    it('should not issue a search when the preview is disabled', async () => {
      renderBuilder({ groupMode: 'flat', showCountPreview: false });

      fireEvent.click(screen.getByTestId('add-condition-button'));

      expect(searchQuery).not.toHaveBeenCalled();
    });
  });

  // These are the handles Playwright addresses the builder through. Before
  // they existed the specs had to reach into RAQB's own DOM — `.rule`,
  // `.rule--field`, `.rule--operator`, `.rule--widget--TEXT`, `.widget--widget`
  // — which is a bet on a third-party library's internals. Asserting them here
  // means a rename cannot pass CI silently.
  describe('Playwright test handles', () => {
    it('should expose the builder root', () => {
      renderBuilder({ groupMode: 'flat' });

      expect(
        screen.getByTestId('query-builder-form-field')
      ).toBeInTheDocument();
    });

    it('should expose the field and operator selects separately', () => {
      renderBuilder({ groupMode: 'flat' });

      expect(
        screen.getAllByTestId('advanced-search-field-select').length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByTestId('advanced-search-operator-select').length
      ).toBeGreaterThan(0);
    });

    it('should expose the conjunction control and its options once a group has two rules', async () => {
      renderBuilder({ groupMode: 'nested' });

      fireEvent.click(screen.getAllByTestId('advanced-search-add-rule')[0]);

      await waitFor(() =>
        expect(
          screen.getAllByTestId('advanced-search-conjunction').length
        ).toBeGreaterThan(0)
      );

      expect(
        screen.getAllByTestId('advanced-search-conjunction-and').length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByTestId('advanced-search-conjunction-or').length
      ).toBeGreaterThan(0);
    });

    it.each(['nested', 'flat'])(
      'should emit the new conjunction when the control is switched (%s)',
      async (groupMode) => {
        const onChange = jest.fn();
        renderBuilder({ groupMode, onChange });

        const addTestId =
          groupMode === 'nested'
            ? 'advanced-search-add-rule'
            : 'add-condition-button';
        fireEvent.click(screen.getAllByTestId(addTestId)[0]);

        await waitFor(() =>
          expect(
            screen.getAllByTestId('advanced-search-conjunction-or').length
          ).toBeGreaterThan(0)
        );

        onChange.mockClear();
        fireEvent.click(
          screen.getAllByTestId('advanced-search-conjunction-or')[0]
        );

        await waitFor(() => expect(onChange).toHaveBeenCalled());

        const emittedTree = onChange.mock.calls.at(-1)?.[1];

        expect(emittedTree?.properties?.conjunction).toBe('OR');
      }
    );

    // RAQB's addGroup only seeds a rule when `shouldCreateEmptyGroup` is
    // falsy. Forcing it true produced a group with nothing in it — a box the
    // user could see but not filter with.
    it('should put a usable rule inside a newly added group', async () => {
      const { container } = renderBuilder({ groupMode: 'nested' });

      const rulesBefore = container.querySelectorAll('.rule').length;
      fireEvent.click(screen.getAllByTestId('advanced-search-add-group')[0]);

      await waitFor(() =>
        expect(container.querySelectorAll('.group').length).toBeGreaterThan(2)
      );

      // The new group must bring its own rule, not arrive empty.
      expect(container.querySelectorAll('.rule').length).toBeGreaterThan(
        rulesBefore
      );
    });

    it('should expose the add and delete affordances by testid in nested mode', () => {
      renderBuilder({ groupMode: 'nested' });

      expect(
        screen.getAllByTestId('advanced-search-add-rule').length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByTestId('advanced-search-add-group').length
      ).toBeGreaterThan(0);
    });
  });

  describe('JSONLogic chrome', () => {
    it('should render the label above the builder', () => {
      renderBuilder({
        outputType: SearchOutputType.JSONLogic,
        label: 'Semantic rule',
      });

      expect(screen.getByText('Semantic rule')).toBeInTheDocument();
    });

    it('should not render a count banner', async () => {
      renderBuilder({ outputType: SearchOutputType.JSONLogic });

      await waitFor(() =>
        expect(
          screen.queryByTestId('view-assets-banner-count')
        ).not.toBeInTheDocument()
      );
    });
  });
});

describe('QueryBuilder – with a complete rule', () => {
  const completeTree = (value: string) =>
    ({
      id: 'root',
      type: 'group',
      properties: { conjunction: 'AND', not: false },
      children1: {
        r1: {
          type: 'rule',
          id: 'r1',
          properties: {
            field: 'description',
            operator: 'like',
            value: [value],
            valueSrc: ['value'],
          },
        },
      },
    } as never);

  it('should count matches and build an explore link', async () => {
    render(
      <QueryBuilder
        showCountPreview
        entityType={EntityType.TABLE}
        groupMode="flat"
        outputType={SearchOutputType.ElasticSearch}
        tree={completeTree('sales')}
      />
    );

    fireEvent.click(screen.getAllByTestId('add-condition-button')[0]);

    await waitFor(() => expect(searchQuery).toHaveBeenCalled(), {
      timeout: 3000,
    });

    expect(getExplorePath).toHaveBeenCalled();
  });

  it('should not count when the preview is switched off', async () => {
    render(
      <QueryBuilder
        entityType={EntityType.TABLE}
        groupMode="flat"
        outputType={SearchOutputType.ElasticSearch}
        showCountPreview={false}
        tree={completeTree('sales')}
      />
    );

    fireEvent.click(screen.getAllByTestId('add-condition-button')[0]);
    await waitFor(() => expect(getExplorePath).toHaveBeenCalled());

    expect(searchQuery).not.toHaveBeenCalled();
  });

  it('should reload when the caller replaces the tree', async () => {
    const { rerender } = render(
      <QueryBuilder
        entityType={EntityType.TABLE}
        groupMode="flat"
        outputType={SearchOutputType.ElasticSearch}
        tree={completeTree('sales')}
      />
    );

    rerender(
      <QueryBuilder
        entityType={EntityType.TABLE}
        groupMode="flat"
        outputType={SearchOutputType.ElasticSearch}
        tree={completeTree('marketing')}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('query-builder-form-field')).toBeInTheDocument()
    );
  });
});

describe('QueryBuilder – defaults', () => {
  it('should render with no output type or entity type given', () => {
    render(<QueryBuilder />);

    expect(screen.getByTestId('query-builder-form-field')).toHaveClass(
      'flat',
      'elasticsearch'
    );
  });

  it('should withhold the explore link when the caller opts out', async () => {
    render(
      <QueryBuilder
        showCountPreview
        entityType={EntityType.TABLE}
        groupMode="flat"
        outputType={SearchOutputType.ElasticSearch}
        showExploreLink={false}
        tree={
          {
            id: 'root',
            type: 'group',
            properties: { conjunction: 'AND', not: false },
            children1: {
              r1: {
                type: 'rule',
                id: 'r1',
                properties: {
                  field: 'description',
                  operator: 'like',
                  value: ['sales'],
                  valueSrc: ['value'],
                },
              },
            },
          } as never
        }
      />
    );

    fireEvent.click(screen.getAllByTestId('add-condition-button')[0]);

    await waitFor(() => expect(searchQuery).toHaveBeenCalled(), {
      timeout: 3000,
    });

    expect(
      screen.queryByTestId('view-assets-banner-button')
    ).not.toBeInTheDocument();
  });
});
