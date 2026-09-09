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
import type {
  Actions,
  Config,
  FieldProps,
} from '@react-awesome-query-builder/ui';
import { EntityType } from '../../../../enums/entity.enum';
import { QUERY_BUILDER_SURFACE } from '../../../../utils/queryBuilder/types';
import { SearchOutputType } from '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import QueryBuilder from '../QueryBuilder';
import { EXPLORE_BUTTON_PRESET } from '../QueryBuilderButton/QueryBuilderButton.constants';
import QueryBuilderCanvas from './QueryBuilderCanvas';
import QueryBuilderControl from './QueryBuilderControl';
import QueryBuilderGroupCard from './QueryBuilderGroupCard';

// setupTests.js globally stubs `advancedSearchClassBase.getQbConfigs` to `{}`.
// These tests render a real builder, so they need the real config.
jest.mock('../../../../utils/AdvancedSearchClassBase', () =>
  jest.requireActual('../../../../utils/AdvancedSearchClassBase')
);

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../../utils/RouterUtils', () => ({
  getExplorePath: jest.fn(),
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

// jest.config sets `clearMocks: true`, which strips implementations declared in
// a module factory after the first test that runs. Re-arm them each time.
beforeEach(() => {
  searchQuery.mockResolvedValue({ hits: { total: { value: 7 } } });
  getExplorePath.mockReturnValue('/explore?');
});

const renderCanvas = (props = {}) =>
  render(
    <QueryBuilder
      entityType={EntityType.TABLE}
      outputType={SearchOutputType.ElasticSearch}
      {...props}
    />
  );

/** Adds a peer group, saying which conjunction joins it. */
const addGroup = (conjunction = 'AND') =>
  fireEvent.click(
    screen.getByTestId(`advanced-search-add-group-${conjunction.toLowerCase()}`)
  );

describe('QueryBuilderCanvas – surface', () => {
  it('should paint the tinted ground by default, for a builder on white', () => {
    renderCanvas();

    expect(screen.getByTestId('query-builder-group-card')).toHaveClass(
      'tw:bg-utility-gray-blue-50'
    );
  });

  it('should paint white when the screen it sits on is already tinted', () => {
    renderCanvas({ surface: QUERY_BUILDER_SURFACE.PLAIN });

    // A white card on an already-white panel needs an edge to read as a card,
    // and the tint moves to its header strip.
    const card = screen.getByTestId('query-builder-group-card');

    expect(card).toHaveClass('tw:bg-primary', 'tw:border', 'tw:border-primary');
    expect(
      card.querySelector('.tw\\:bg-utility-gray-blue-50')
    ).toBeInTheDocument();
  });

  it('should carry the tint on the card itself for a builder on white', () => {
    renderCanvas();

    const card = screen.getByTestId('query-builder-group-card');

    expect(card).toHaveClass('tw:bg-utility-gray-blue-50');
    expect(card).not.toHaveClass('tw:border');
  });

  it('should keep peer cards on the same ground', async () => {
    renderCanvas({ groupMode: 'nested' });

    addGroup();

    await waitFor(() =>
      expect(screen.getAllByTestId('query-builder-group-card')).toHaveLength(2)
    );

    // Two groups added from the same button are peers, not one inside the
    // other, so they share the ground rather than alternating.
    screen.getAllByTestId('query-builder-group-card').forEach((card) => {
      expect(card).toHaveClass('tw:bg-utility-gray-blue-50');
    });
  });
});

describe('QueryBuilderCanvas – structure', () => {
  it('should not draw a card around a single card', () => {
    // RAQB seeds a wrapper group around the first real one. Drawing it would
    // box a card inside a card and put a conjunction over nothing to conjoin.
    renderCanvas({ groupMode: 'nested' });

    expect(screen.getAllByTestId('query-builder-group-card')).toHaveLength(1);
  });

  it('should keep the add-group affordance off a builder that cannot nest', () => {
    renderCanvas({ groupMode: 'flat' });

    expect(
      screen.queryByTestId('advanced-search-add-group')
    ).not.toBeInTheDocument();
  });

  it('should offer no controls at all when readonly', () => {
    renderCanvas({ groupMode: 'nested', readonly: true });

    expect(
      screen.queryByTestId('advanced-search-add-rule')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('advanced-search-add-group')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('advanced-search-delete-rule')
    ).not.toBeInTheDocument();
  });
});

describe('QueryBuilderCanvas – peer groups', () => {
  it('should add a group beside the card, not inside it', async () => {
    renderCanvas({ groupMode: 'nested' });

    addGroup();

    await waitFor(() =>
      expect(screen.getAllByTestId('query-builder-group-card')).toHaveLength(2)
    );

    // Peers, so neither card contains the other.
    const [first, second] = screen.getAllByTestId('query-builder-group-card');

    expect(first).not.toContainElement(second);
  });

  it('should join two peer cards with the conjunction that combines them', async () => {
    renderCanvas({ groupMode: 'nested' });

    expect(
      screen.queryByTestId('query-builder-group-connector')
    ).not.toBeInTheDocument();

    addGroup();

    await waitFor(() =>
      expect(
        screen.getByTestId('query-builder-group-connector')
      ).toBeInTheDocument()
    );

    // One connector for two cards, and it is a dropdown rather than the tab
    // group a card uses for its own rules.
    expect(screen.getAllByTestId('query-builder-group-connector')).toHaveLength(
      1
    );
    expect(
      screen.getByTestId('advanced-search-group-conjunction')
    ).toBeInTheDocument();
  });

  it('should let a peer card be removed once there is more than one', async () => {
    renderCanvas({ groupMode: 'nested' });

    expect(
      screen.queryByTestId('advanced-search-delete-group')
    ).not.toBeInTheDocument();

    addGroup();

    await waitFor(() =>
      expect(
        screen.getAllByTestId('advanced-search-delete-group')
      ).toHaveLength(2)
    );
  });
});

describe('QueryBuilderCanvas – conjunction', () => {
  it('should say what the conjunction means, and follow it when switched', async () => {
    renderCanvas({ groupMode: 'nested' });
    fireEvent.click(screen.getByTestId('advanced-search-add-rule'));

    await waitFor(() =>
      expect(
        screen.getByText('message.all-conditions-must-match')
      ).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('advanced-search-conjunction-or'));

    await waitFor(() =>
      expect(
        screen.getByText('message.any-condition-can-match')
      ).toBeInTheDocument()
    );
  });

  it('should offer no control when the caller fixed the conjunction', () => {
    renderCanvas({ conjunctionMode: 'and' });

    // Nothing to choose between — the helper text still says how the rules
    // combine.
    expect(
      screen.queryByTestId('advanced-search-conjunction')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('message.all-conditions-must-match')
    ).toBeInTheDocument();
  });

  it('should offer no control when the caller hides it', () => {
    renderCanvas({ showConjunction: false });

    expect(
      screen.queryByTestId('advanced-search-conjunction')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('message.all-conditions-must-match')
    ).toBeInTheDocument();
  });
});

describe('QueryBuilderCanvas – labels', () => {
  it('should label all three columns of a rule', () => {
    renderCanvas();

    // `t()` resolves to the key under jest, so these are the keys the
    // canvas asks for — the locale files carry the wording.
    expect(screen.getByText('label.field')).toBeInTheDocument();
    expect(screen.getByText('label.operator')).toBeInTheDocument();
    expect(screen.getByText('label.value')).toBeInTheDocument();
  });
});

describe('QueryBuilderCanvas – component contracts', () => {
  const actions = {
    addGroup: jest.fn(),
    addRule: jest.fn(),
    removeGroup: jest.fn(),
    removeRule: jest.fn(),
    setConjunction: jest.fn(),
    setField: jest.fn(),
    setOperator: jest.fn(),
    setValue: jest.fn(),
  } as unknown as Actions;

  // A field renderer that reports back the moment it is asked to change, so a
  // test can drive the control without going through react-aria's combobox.
  const renderFieldStub = (props: FieldProps) => (
    <button
      data-testid={
        (props as unknown as { dataTestId?: string }).dataTestId ??
        'advanced-search-field-select'
      }
      type="button"
      onClick={() => props.setField('picked')}>
      {String(props.selectedKey ?? '')}
    </button>
  );

  const config = {
    conjunctions: { AND: {}, OR: {} },
    fields: {
      tags: { label: 'Tags', subfields: { tagFQN: { label: 'Tag' } } },
    },
    operators: {},
    settings: { renderField: renderFieldStub },
    widgets: {},
  } as unknown as Config;

  const context = {
    actions,
    allowGroups: true,
    canRemoveRule: true,
    config,
    preset: EXPLORE_BUTTON_PRESET,
    readonly: false,
    ruleIndexById: {},
    showConjunction: true,
    surface: QUERY_BUILDER_SURFACE.SUBTLE,
  };

  it('should render nothing before a tree exists', () => {
    const { container } = render(
      <QueryBuilderCanvas
        allowGroups
        showConjunction
        actions={actions}
        config={config}
        preset={EXPLORE_BUTTON_PRESET}
        readonly={false}
        surface={QUERY_BUILDER_SURFACE.SUBTLE}
        tree={undefined}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should default a group with no conjunction of its own to AND', () => {
    render(
      <QueryBuilderGroupCard
        canRemove
        context={context}
        depth={0}
        group={{}}
        path={['root']}
      />
    );

    expect(
      screen.getByTestId('advanced-search-conjunction-and')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.all-conditions-must-match')
    ).toBeInTheDocument();
  });

  it('should remove the group it belongs to', () => {
    render(
      <QueryBuilderGroupCard
        canRemove
        context={context}
        depth={0}
        group={{}}
        path={['root', 'g1']}
      />
    );

    fireEvent.click(screen.getByTestId('advanced-search-delete-group'));

    expect(actions.removeGroup).toHaveBeenCalledWith(['root', 'g1']);
  });

  it("should edit a rule_group's field from the row, not beside the conjunction", () => {
    render(
      <QueryBuilderGroupCard
        canRemove
        context={context}
        depth={0}
        group={{
          children1: [{ id: 'r1' }],
          properties: { field: 'tags' },
          type: 'rule_group',
        }}
        path={['root', 'g1']}
      />
    );

    // One Field control, in the row where the design puts it — and it edits
    // the group, which is what its children filter subfields of.
    expect(screen.getAllByTestId('advanced-search-field-select')).toHaveLength(
      1
    );

    fireEvent.click(screen.getByTestId('advanced-search-field-select'));

    expect(actions.setField).toHaveBeenCalledWith(['root', 'g1'], 'picked');
  });

  it('should alternate the ground for a card genuinely inside another', () => {
    render(
      <QueryBuilderGroupCard
        canRemove
        context={context}
        depth={0}
        group={{ children1: [{ id: 'nested', type: 'group' }] }}
        path={['root']}
      />
    );

    const [outer, inner] = screen.getAllByTestId('query-builder-group-card');

    expect(outer).toHaveClass('tw:bg-utility-gray-blue-50');
    expect(inner).toHaveClass('tw:bg-primary');
  });

  it('should name a nested child card by its position when it has no id', () => {
    render(
      <QueryBuilderGroupCard
        canRemove
        context={context}
        depth={0}
        group={{ children1: [{ type: 'group' }, {}] }}
        path={['root']}
      />
    );

    // one card for the group itself, one for the nested child; the id-less
    // rule beside it renders as a row
    expect(screen.getAllByTestId('query-builder-group-card')).toHaveLength(2);
    expect(screen.getAllByTestId(/^query-builder-rule-\d+$/)).toHaveLength(1);
  });

  it('should fall back to a generic add-field label when the preset carries none', () => {
    render(
      <QueryBuilderGroupCard
        canRemove
        context={{
          ...context,
          preset: { ...EXPLORE_BUTTON_PRESET, addRuleLabel: undefined },
        }}
        depth={0}
        group={{}}
        path={['root']}
      />
    );

    expect(screen.getByTestId('advanced-search-add-rule')).toHaveTextContent(
      'label.add-new-entity'
    );
  });

  it('should render a card even for a config that declares no conjunctions', () => {
    render(
      <QueryBuilderGroupCard
        canRemove
        context={{
          ...context,
          config: { ...config, conjunctions: undefined } as unknown as Config,
        }}
        depth={0}
        group={{}}
        path={['root']}
      />
    );

    expect(screen.getByTestId('query-builder-group-card')).toBeInTheDocument();
    expect(
      screen.queryByTestId('advanced-search-conjunction-and')
    ).not.toBeInTheDocument();
  });

  it('should render its label even when no renderer is registered', () => {
    render(
      <QueryBuilderControl
        items={[]}
        label="Field"
        placeholder="Field"
        readonly={false}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByText('Field')).toBeInTheDocument();
  });
});
