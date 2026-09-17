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
  getStructLevel,
  getSurfaceForDepth,
  resolveSelectedField,
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
  // a `!struct`: a level the row splits into its own control
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

  it('should keep a `!struct` selectable too, so the row can split it', () => {
    // Nesting it here made `OMFieldSelect` flatten the parent away, which is
    // why Custom Properties showed one entry per property instead of the two
    // controls a `!group` gets. `getStructLevel` provides the level instead.
    const struct = toFieldNodes(FIELDS)[2];

    expect(struct).toEqual({
      key: 'extension',
      label: 'Custom Properties',
      path: 'extension',
    });
    expect(struct.items).toBeUndefined();
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

  it('should not offer a struct with no subfields at all', () => {
    expect(
      toFieldNodes({
        outer: { label: 'Outer', subfields: {}, type: '!struct' },
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

describe('struct levels', () => {
  const config = { fields: FIELDS };

  it('should split a struct-owned field into its level and its leaf', () => {
    expect(getStructLevel(config, 'extension.size')).toEqual({
      field: 'extension',
      subfields: FIELDS.extension.subfields,
    });
  });

  it('should not claim a field that owns no struct', () => {
    expect(getStructLevel(config, 'tags.tagFQN')).toBeUndefined();
    expect(getStructLevel(config, 'name')).toBeUndefined();
    expect(getStructLevel(config, undefined)).toBeUndefined();
  });

  it('should land a struct choice on something inside it', () => {
    // A struct is a level, not a field to filter on: setting the rule to one
    // would leave it naming nothing RAQB can build a condition from.
    expect(resolveSelectedField(config, 'extension')).toBe('extension.size');
  });

  it('should leave every other choice alone', () => {
    expect(resolveSelectedField(config, 'tags')).toBe('tags');
    expect(resolveSelectedField(config, 'name')).toBe('name');
  });
});
