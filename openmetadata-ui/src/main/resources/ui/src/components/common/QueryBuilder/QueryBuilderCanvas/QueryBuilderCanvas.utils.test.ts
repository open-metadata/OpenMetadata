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
import { QUERY_BUILDER_SURFACE } from '../../../../utils/queryBuilder/types';
import {
  countRules,
  getRuleRowModel,
  getSurfaceForDepth,
  toFieldNodes,
} from './QueryBuilderCanvas.utils';

const FIELDS = {
  name: { label: 'Name' },
  // a `!group`: carries subfields but is selectable itself
  tags: {
    label: 'Tags',
    type: '!group',
    subfields: { tagFQN: { label: 'Tag' } },
  },
  // a `!struct`: only groups its subfields
  extension: {
    label: 'Custom Properties',
    type: '!struct',
    subfields: { size: { label: 'Size' } },
  },
};

describe('toFieldNodes', () => {
  it('should keep a `!group` selectable rather than folding it into its subfields', () => {
    // The regression this guards: `OMFieldSelect` renders only leaves, so a
    // field turned into a parent disappears from the picker — which is how
    // Tags, Tier and Glossary Term went missing.
    const [name, tags] = toFieldNodes(FIELDS);

    expect(name).toEqual({ key: 'name', label: 'Name', path: 'name' });
    expect(tags).toEqual({ key: 'tags', label: 'Tags', path: 'tags' });
    expect(tags.items).toBeUndefined();
  });

  it('should group a `!struct` around its subfields, as RAQB does', () => {
    const struct = toFieldNodes(FIELDS)[2];

    expect(struct.path).toBe('extension');
    expect(struct.items?.map((item) => item.path)).toEqual(['extension.size']);
  });

  it('should not offer a field that groups nothing', () => {
    expect(
      toFieldNodes({
        empty: { label: 'Custom Properties', subfields: {}, type: '!group' },
        name: { label: 'Name' },
      })
    ).toEqual([{ key: 'name', label: 'Name', path: 'name' }]);
  });

  it('should keep offering a group once it has subfields', () => {
    expect(
      toFieldNodes({
        extension: {
          label: 'Custom Properties',
          subfields: { table: { label: 'Table' } },
          type: '!group',
        },
      })
    ).toEqual([
      { key: 'extension', label: 'Custom Properties', path: 'extension' },
    ]);
  });

  it('should not offer a struct whose subfields all drop out', () => {
    expect(
      toFieldNodes({
        outer: {
          label: 'Outer',
          subfields: {
            inner: { label: 'Inner', subfields: {}, type: '!group' },
          },
          type: '!struct',
        },
      })
    ).toEqual([]);
  });

  it('should fall back to the key when a field carries no label', () => {
    expect(toFieldNodes({ raw: {} })).toEqual([
      { key: 'raw', label: 'raw', path: 'raw' },
    ]);
  });

  it('should tolerate a missing field map', () => {
    expect(toFieldNodes(undefined)).toEqual([]);
  });
});

describe('countRules', () => {
  it('should count leaves at any depth, not the groups holding them', () => {
    expect(
      countRules({
        children1: [{ id: 'a' }, { children1: [{ id: 'b' }, { id: 'c' }] }],
      })
    ).toBe(3);
  });

  it('should count a lone rule and an absent tree', () => {
    expect(countRules({ id: 'only' })).toBe(1);
    expect(countRules(undefined)).toBe(0);
  });
});

describe('getSurfaceForDepth', () => {
  it.each([
    [QUERY_BUILDER_SURFACE.SUBTLE, 0, QUERY_BUILDER_SURFACE.SUBTLE],
    [QUERY_BUILDER_SURFACE.SUBTLE, 1, QUERY_BUILDER_SURFACE.PLAIN],
    [QUERY_BUILDER_SURFACE.SUBTLE, 2, QUERY_BUILDER_SURFACE.SUBTLE],
    [QUERY_BUILDER_SURFACE.PLAIN, 0, QUERY_BUILDER_SURFACE.PLAIN],
    [QUERY_BUILDER_SURFACE.PLAIN, 1, QUERY_BUILDER_SURFACE.SUBTLE],
  ])(
    'should alternate %s at depth %i to %s so nesting stays readable',
    (base, depth, expected) => {
      expect(getSurfaceForDepth(base, depth)).toBe(expected);
    }
  );
});

describe('getRuleRowModel', () => {
  // Only `getFieldConfig` is consulted, and only for its subfields.
  const CONFIG = {
    fields: {
      // several subfields: a level the user picks within
      extension: {
        subfields: { table: { label: 'Table' }, topic: { label: 'Topic' } },
      },
      // one subfield that opens onto more: still a level to walk through
      lone: {
        subfields: { table: { subfields: { prop: { label: 'Prop' } } } },
      },
      // one leaf subfield and no defaultField: the persona editor's custom
      // properties, scoped to one entity type, can look exactly like this
      loneLeaf: { subfields: { onlyProp: { label: 'Only Prop' } } },
      // names a defaultField: RAQB fills the subfield in, so it is not a
      // choice — this is the shape a contract's semantic rule has
      owners: {
        defaultField: 'name',
        subfields: { name: { label: 'Name' } },
      },
    },
    settings: { fieldSeparator: '.' },
  };

  const rule = (id: string, field?: string) => ({
    id,
    ...(field ? { properties: { field } } : {}),
  });

  it('should give a plain rule the single cell it draws', () => {
    const model = getRuleRowModel(CONFIG, rule('r1', 'name'), ['root', 'r1']);

    expect(model?.rule.id).toBe('r1');
    expect(model?.path).toEqual(['root', 'r1']);
    expect(model?.cells).toEqual([
      { field: 'name', fields: undefined, path: ['root', 'r1'], prefix: '' },
    ]);
  });

  it('should add a cell per drill level, each choosing within the one above', () => {
    const model = getRuleRowModel(
      CONFIG,
      {
        children1: [rule('r1')],
        id: 'drill',
        properties: { field: 'extension' },
        type: 'rule_group',
      },
      ['root', 'drill']
    );

    expect(model?.path).toEqual(['root', 'drill', 'r1']);
    expect(model?.cells).toEqual([
      {
        field: 'extension',
        fields: undefined,
        path: ['root', 'drill'],
        prefix: '',
      },
      {
        field: null,
        fields: CONFIG.fields.extension.subfields,
        path: ['root', 'drill', 'r1'],
        prefix: 'extension',
      },
    ]);
  });

  it('should not give a level with nothing to choose a cell of its own', () => {
    // `owners` owns one subfield, so RAQB sets it — a control over it could
    // not change anything, and the row keeps editing the group's field.
    const model = getRuleRowModel(
      CONFIG,
      {
        children1: [rule('r1', 'owners.name')],
        id: 'g1',
        properties: { field: 'owners' },
        type: 'rule_group',
      },
      ['root', 'g1']
    );

    expect(model?.cells).toHaveLength(1);
    expect(model?.cells[0].field).toBe('owners');
    expect(model?.rule.id).toBe('r1');
  });

  it('should leave a group the user built to its card', () => {
    expect(
      getRuleRowModel(CONFIG, { children1: [rule('r1')], type: 'group' }, [
        'root',
      ])
    ).toBeUndefined();
  });

  it('should leave a level holding several rules to its card', () => {
    expect(
      getRuleRowModel(
        CONFIG,
        {
          children1: [rule('r1'), rule('r2')],
          properties: { field: 'extension' },
          type: 'rule_group',
        },
        ['root', 'g1']
      )
    ).toBeUndefined();
  });

  it('should address a child that carries no id by position', () => {
    const model = getRuleRowModel(
      CONFIG,
      {
        children1: [{}],
        properties: { field: 'extension' },
        type: 'rule_group',
      },
      ['root', 'drill']
    );

    expect(model?.path).toEqual(['root', 'drill', '0']);
  });

  it('should treat a level with no field as offering nothing to drill into', () => {
    const model = getRuleRowModel(
      CONFIG,
      { children1: [rule('r1')], type: 'rule_group' },
      ['root', 'g1']
    );

    expect(model?.cells).toEqual([
      { field: null, fields: undefined, path: ['root', 'g1'], prefix: '' },
    ]);
  });

  it('should still walk a level whose only subfield opens onto more', () => {
    const model = getRuleRowModel(
      CONFIG,
      {
        children1: [rule('r1')],
        id: 'drill',
        properties: { field: 'lone' },
        type: 'rule_group',
      },
      ['root', 'drill']
    );

    expect(model?.cells).toHaveLength(2);
    expect(model?.cells[1]).toEqual({
      field: null,
      fields: CONFIG.fields.lone.subfields,
      path: ['root', 'drill', 'r1'],
      prefix: 'lone',
    });
  });

  it('should still offer a level holding a single leaf nobody defaults to', () => {
    // The regression: a persona rule scoped to one entity type with one
    // custom property defined has exactly one leaf subfield. Treating a lone
    // leaf as RAQB's own doing hid the only control that could reach it.
    const model = getRuleRowModel(
      CONFIG,
      {
        children1: [rule('r1')],
        id: 'drill',
        properties: { field: 'loneLeaf' },
        type: 'rule_group',
      },
      ['root', 'drill']
    );

    expect(model?.cells).toHaveLength(2);
    expect(model?.cells[1].fields).toEqual(CONFIG.fields.loneLeaf.subfields);
  });
});
