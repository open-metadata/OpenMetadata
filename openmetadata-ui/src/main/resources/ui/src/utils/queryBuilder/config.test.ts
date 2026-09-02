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
  ButtonProps,
  ConfigContext,
} from '@react-awesome-query-builder/ui';
import { SearchOutputType } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { SearchIndex } from '../../enums/search.enum';
import { buildQueryBuilderConfig } from './config';
import { EntityType } from '../../enums/entity.enum';
import advancedSearchClassBase from '../AdvancedSearchClassBase';

// setupTests.js globally stubs `advancedSearchClassBase.getQbConfigs` to `{}`
// to paper over a circular-import problem. This suite is about the config that
// call actually produces, so it opts back into the real implementation.
jest.mock('../AdvancedSearchClassBase', () =>
  jest.requireActual('../AdvancedSearchClassBase')
);

const renderOf = (
  type: string,
  config: ReturnType<typeof buildQueryBuilderConfig>
) =>
  config.settings.renderButton?.({ type } as ButtonProps, {} as ConfigContext);

const buildEs = (
  options: Partial<Parameters<typeof buildQueryBuilderConfig>[0]> = {}
) =>
  buildQueryBuilderConfig({
    outputType: SearchOutputType.ElasticSearch,
    searchIndex: SearchIndex.TABLE,
    ...options,
  });

describe('buildQueryBuilderConfig', () => {
  describe('groupMode', () => {
    it('should withhold addGroup and delGroup in flat mode', () => {
      const config = buildEs({ groupMode: 'flat' });

      expect(renderOf('addGroup', config)).toBeNull();
      expect(renderOf('delGroup', config)).toBeNull();
    });

    it('should still render rule buttons in flat mode', () => {
      const config = buildEs({ groupMode: 'flat' });

      expect(renderOf('addRule', config)).not.toBeNull();
      expect(renderOf('delRule', config)).not.toBeNull();
    });

    it('should not suppress delRuleGroup in flat mode, because a rule_group is structural', () => {
      const config = buildEs({ groupMode: 'flat' });

      expect(renderOf('delRuleGroup', config)).not.toBeNull();
    });

    it('should render addGroup and delGroup in nested mode', () => {
      const config = buildEs({ groupMode: 'nested' });

      expect(renderOf('addGroup', config)).not.toBeNull();
      expect(renderOf('delGroup', config)).not.toBeNull();
    });

    it('should set canRegroup from the mode', () => {
      expect(buildEs({ groupMode: 'flat' }).settings.canRegroup).toBe(false);
      expect(buildEs({ groupMode: 'nested' }).settings.canRegroup).toBe(true);
    });

    // `canAddNewRule = !shouldCreateEmptyGroup` in RAQB's addGroup
    // (stores/tree.js:40-56). Forcing it true makes every new group arrive with
    // no rule inside — an empty box the user cannot filter with.
    it('should let a new group arrive with a rule inside it', () => {
      expect(
        buildEs({ groupMode: 'nested' }).settings.shouldCreateEmptyGroup
      ).not.toBe(true);
      expect(
        buildEs({ groupMode: 'flat' }).settings.shouldCreateEmptyGroup
      ).not.toBe(true);
    });

    it('should never set maxNesting, which would break already-nested saved trees', () => {
      expect(
        buildEs({ groupMode: 'flat' }).settings.maxNesting
      ).toBeUndefined();
    });
  });

  describe('entityType', () => {
    it('should carry a concrete entity type for the formatter', () => {
      const settings = buildEs({ entityType: EntityType.TABLE })
        .settings as unknown as Record<string, unknown>;

      expect(settings.omEntityType).toBe(EntityType.TABLE);
    });

    it('should not carry ALL as an entity type', () => {
      const settings = buildEs({ entityType: EntityType.ALL })
        .settings as unknown as Record<string, unknown>;

      expect(settings.omEntityType).toBeUndefined();
    });
  });

  describe('conjunctionMode', () => {
    it('should keep both conjunctions when editable', () => {
      const config = buildEs({ conjunctionMode: 'editable' });

      expect(Object.keys(config.conjunctions).sort()).toEqual(['AND', 'OR']);
    });

    it('should narrow to a single conjunction when fixed, which also hides the control', () => {
      expect(
        Object.keys(buildEs({ conjunctionMode: 'and' }).conjunctions)
      ).toEqual(['AND']);
      expect(
        Object.keys(buildEs({ conjunctionMode: 'or' }).conjunctions)
      ).toEqual(['OR']);
    });
  });

  describe('readonly', () => {
    it('should block editing and removal', () => {
      const { settings } = buildEs({ readonly: true });

      expect(settings.immutableFieldsMode).toBe(true);
      expect(settings.immutableValuesMode).toBe(true);
      // The one that actually hides delRule / delGroup / the add buttons.
      expect(settings.immutableGroupsMode).toBe(true);
    });

    it('should leave the tree editable by default', () => {
      expect(buildEs().settings.immutableGroupsMode).not.toBe(true);
    });
  });

  describe('labels and operators', () => {
    it('should show labels and raw operator names by default', () => {
      const config = buildEs();

      expect(config.settings.showLabels).toBe(true);
      expect(config.operators.equal.label).not.toBe('label.is');
    });

    it('should use friendly operator labels when asked', () => {
      const config = buildEs({ useFriendlyOperatorLabels: true });

      expect(config.operators.equal.label).toBe('label.is');
      expect(config.operators.is_not_null.label).toBe('label.is-set');
    });

    it('should hide labels when asked', () => {
      expect(buildEs({ showLabels: false }).settings.showLabels).toBe(false);
    });
  });

  it('should keep a seeded empty tree on screen', () => {
    const { settings } = buildEs();

    expect(settings.removeEmptyGroupsOnLoad).toBe(false);
    expect(settings.removeEmptyRulesOnLoad).toBe(false);
  });

  it('should let a caller allow-list fields', () => {
    const fields = { name: { label: 'Name', type: 'text' } };
    const config = buildEs({ fields });

    expect(Object.keys(config.fields)).toEqual(['name']);
  });

  it('should apply configOverrides last', () => {
    const config = buildEs({
      readonly: true,
      configOverrides: { settings: { immutableGroupsMode: false } },
    });

    expect(config.settings.immutableGroupsMode).toBe(false);
  });

  it('should build a JSONLogic config from the JSONLogic class base', () => {
    const config = buildQueryBuilderConfig({
      outputType: SearchOutputType.JSONLogic,
      searchIndex: SearchIndex.TABLE,
    });

    expect(config.fields).toBeDefined();
    expect(Object.keys(config.fields).length).toBeGreaterThan(0);
  });
});

describe('buildQueryBuilderConfig – fallbacks and edges', () => {
  type RenderButton = (props?: { type?: string }, ctx?: unknown) => unknown;

  it('should cope with a class base that returns nothing', () => {
    const spy = jest
      .spyOn(advancedSearchClassBase, 'getQbConfigs')
      .mockReturnValue({} as never);

    try {
      const config = buildEs({ groupMode: 'flat' });
      const render = config.settings.renderButton as unknown as RenderButton;

      expect(render({ type: 'addGroup' })).toBeNull();
      expect(render({ type: 'addRule' })).toBeUndefined();
      expect(config.fields).toBeUndefined();
      expect(config.conjunctions).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });

  it('should tolerate a button render call with no props', () => {
    const render = buildEs({ groupMode: 'flat' }).settings
      .renderButton as unknown as RenderButton;

    expect(() => render()).not.toThrow();
  });

  it('should leave conjunctions alone when the fixed one is not available', () => {
    const config = buildEs({
      conjunctionMode: 'or',
      configOverrides: {
        conjunctions: { AND: { label: 'And' } } as never,
      },
    });

    expect(Object.keys(config.conjunctions)).toEqual(['AND']);
  });

  it('should prefer overridden fields over the caller allow-list', () => {
    const config = buildEs({
      fields: { a: { label: 'A', type: 'text' } } as never,
      configOverrides: {
        fields: { b: { label: 'B', type: 'text' } } as never,
      },
    });

    expect(Object.keys(config.fields)).toEqual(['b']);
  });

  it('should accept a single search index as well as a list', () => {
    expect(
      buildEs({ searchIndex: [SearchIndex.TABLE, SearchIndex.TOPIC] }).fields
    ).toBeDefined();
  });

  it('should cope with a class base that returns undefined', () => {
    const spy = jest
      .spyOn(advancedSearchClassBase, 'getQbConfigs')
      .mockReturnValue(undefined as never);

    try {
      const config = buildEs();

      expect(config.fields).toBeUndefined();
      expect(config.conjunctions).toBeUndefined();
      expect(config.settings).toBeDefined();
    } finally {
      spy.mockRestore();
    }
  });
});
