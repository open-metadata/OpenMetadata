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
import { OldJsonTree, Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { SearchOutputType } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { EntityReferenceFields } from '../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../enums/search.enum';
import { getEntityLifecycleStages } from '../../rest/metadataTypeAPI';
import { JSONLogicSearchClassBase } from '../JSONLogicSearchClassBase';
import { generateUUID } from '../StringUtils';
import { formatQuery } from './formatters';
import {
  collapseColumnTagsVar,
  expandColumnTagsVar,
} from './jsonLogicColumnTags';
import { loadQueryBuilderTree } from './tree';

jest.mock('../../rest/metadataTypeAPI', () => ({
  getEntityLifecycleStages: jest.fn(),
}));

const tagFqn = { var: 'tagFQN' };
const equalsPii = { '==': [tagFqn, 'PII.Sensitive'] };
const flat = { some: [{ var: 'columns.tags' }, equalsPii] };
const nested = {
  some: [{ var: 'columns' }, { some: [{ var: 'tags' }, equalsPii] }],
};

describe('expandColumnTagsVar / collapseColumnTagsVar', () => {
  it('expands the column tags group into a some over columns of a some over tags', () => {
    expect(expandColumnTagsVar(flat)).toEqual(nested);
  });

  it('expands inside negations and conjunctions', () => {
    expect(expandColumnTagsVar({ and: [{ '!': flat }] })).toEqual({
      and: [{ '!': nested }],
    });
  });

  it('collapses the nested form back to the column tags group', () => {
    expect(collapseColumnTagsVar({ or: [{ '!': nested }] })).toEqual({
      or: [{ '!': flat }],
    });
  });

  it('leaves the entity Tags group and other some groups untouched', () => {
    const logic = {
      and: [
        { some: [{ var: 'tags' }, equalsPii] },
        { some: [{ var: 'columns' }, { '==': [{ var: 'name' }, 'id'] }] },
      ],
    };

    expect(expandColumnTagsVar(logic)).toEqual(logic);
    expect(collapseColumnTagsVar(logic)).toEqual(logic);
  });
});

const buildColumnTagsTree = (
  operator: string,
  value: unknown[],
  valueType: string[]
): OldJsonTree => {
  const group = generateUUID();
  const rule = generateUUID();

  return {
    id: generateUUID(),
    type: 'group',
    properties: { conjunction: 'AND', not: false },
    children1: {
      [group]: {
        type: 'rule_group',
        id: group,
        properties: {
          conjunction: 'AND',
          not: false,
          mode: 'some',
          field: EntityReferenceFields.COLUMN_TAG,
          fieldSrc: 'field',
        },
        children1: {
          [rule]: {
            type: 'rule',
            id: rule,
            properties: {
              field: `${EntityReferenceFields.COLUMN_TAG}.tagFQN`,
              operator,
              value,
              valueSrc: value.map(() => 'value'),
              valueType,
              fieldSrc: 'field',
            },
          },
        },
      },
    },
  };
};

const groupAndOperatorOf = (loaded: Parameters<typeof QbUtils.getTree>[0]) => {
  const tree = QbUtils.getTree(loaded) as {
    children1?: Array<{
      properties: { field?: string };
      children1?: Array<{ properties: { operator?: string } }>;
    }>;
  };
  const groupNode = tree.children1?.[0];

  return {
    group: groupNode?.properties?.field,
    operator: groupNode?.children1?.[0]?.properties?.operator,
  };
};

describe('Column Tags rule through the workflow builder pipeline', () => {
  let config: ReturnType<JSONLogicSearchClassBase['getQbConfigs']>;

  beforeEach(() => {
    (getEntityLifecycleStages as jest.Mock).mockResolvedValue({
      stages: [],
      entityTypes: [],
    });
    config = new JSONLogicSearchClassBase().getQbConfigs([SearchIndex.TABLE]);
  });

  it.each([
    ['select_equals', ['PII.Sensitive'], ['select']],
    ['select_not_equals', ['PII.Sensitive'], ['select']],
    ['select_any_in', [['PII.Sensitive']], ['multiselect']],
    ['select_not_any_in', [['PII.Sensitive']], ['multiselect']],
    ['is_null', [], []],
    ['is_not_null', [], []],
  ])(
    'saves %s against columns then tags and loads it back into Column Tags',
    (operator, value, valueType) => {
      const tree = QbUtils.checkTree(
        QbUtils.loadTree(buildColumnTagsTree(operator, value, valueType)),
        config
      );
      const saved = formatQuery(
        tree as never,
        config,
        SearchOutputType.JSONLogic
      ).value;

      expect(saved).toContain(
        '{"some":[{"var":"columns"},{"some":[{"var":"tags"},'
      );
      expect(saved).not.toContain('columns.tags');

      const loaded = loadQueryBuilderTree({
        config,
        value: saved,
        outputType: SearchOutputType.JSONLogic,
      });

      expect(groupAndOperatorOf(loaded)).toEqual({
        group: EntityReferenceFields.COLUMN_TAG,
        operator,
      });
      expect(
        formatQuery(loaded as never, config, SearchOutputType.JSONLogic).value
      ).toBe(saved);
    }
  );

  it('loads a rule stored before the fix (columns.tags var) into Column Tags', () => {
    const loaded = loadQueryBuilderTree({
      config,
      value: JSON.stringify({ and: [flat] }),
      outputType: SearchOutputType.JSONLogic,
    });

    expect(groupAndOperatorOf(loaded)).toEqual({
      group: EntityReferenceFields.COLUMN_TAG,
      operator: 'select_equals',
    });
  });
});
