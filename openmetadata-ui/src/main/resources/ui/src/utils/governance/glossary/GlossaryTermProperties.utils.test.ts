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

import { InheritedPropertyEntry } from './GlossaryTermProperties.types';
import { EffectiveGlossaryTermProperty } from '../../../generated/entity/data/glossaryTerm';
import {
  GlossaryTermProperty,
  GlossaryTermPropertyDatatype,
} from '../../../generated/type/glossaryTermProperty';
import { GlossaryTermPropertyRow } from './GlossaryTermProperties.types';
import {
  buildAddPropertyPatch,
  buildCreatePropertyFields,
  buildDeletePropertyPatch,
  buildEditPropertyPatch,
  buildOverridePatch,
  buildPropertyDefinition,
  buildResetPatch,
  EMPTY_PROPERTY_DRAFT,
  formatPropertyValue,
  getInheritableEntries,
  getPropertyCounts,
  getPropertySource,
  parseEnumValues,
  sanitizePropertyName,
  sortEffectiveProperties,
  validatePropertyDraft,
  validatePropertyRows,
  validatePropertyValue,
} from './GlossaryTermProperties.utils';

const ref = (id: string, name: string) => ({
  id,
  name,
  type: 'glossaryTerm',
});

const scope: GlossaryTermProperty = {
  name: 'regulatoryScope',
  displayName: 'Regulatory scope',
  datatype: GlossaryTermPropertyDatatype.Enum,
  enumValues: ['GDPR', 'CCPA'],
};
const retention: GlossaryTermProperty = {
  name: 'retentionDays',
  datatype: GlossaryTermPropertyDatatype.Decimal,
  unit: 'days',
};

const effective = (
  property: GlossaryTermProperty,
  declaredBy: string,
  options: { values?: string[]; valuesFrom?: string; termId?: string } = {}
): EffectiveGlossaryTermProperty => ({
  property,
  declaredBy: ref(declaredBy, declaredBy),
  inherited: declaredBy !== options.termId,
  values: options.values ?? [],
  ...(options.valuesFrom
    ? { valuesFrom: ref(options.valuesFrom, options.valuesFrom) }
    : {}),
});

describe('sanitizePropertyName', () => {
  it.each([
    ['Data owner team', 'Data owner team'],
    ['  Sla / tier  ', 'Sla tier'],
    ['~!Retention: days*', 'Retention days'],
    ['"quoted" \\ name', 'quoted name'],
    ['***', ''],
  ])('turns %j into %j', (input, expected) => {
    expect(sanitizePropertyName(input)).toBe(expected);
  });

  it('caps the name at the schema limit', () => {
    expect(sanitizePropertyName('a'.repeat(300))).toHaveLength(256);
  });
});

describe('parseEnumValues', () => {
  it('trims, drops blanks and keeps the first of duplicates', () => {
    expect(parseEnumValues(' Gold, Silver ,, Gold,Bronze ')).toEqual([
      'Gold',
      'Silver',
      'Bronze',
    ]);
  });
});

describe('validatePropertyValue', () => {
  const check = (datatype: GlossaryTermPropertyDatatype, value: string) =>
    validatePropertyValue({ datatype, enumValues: ['GDPR'] }, value)?.key;

  it('accepts an empty value for every datatype', () => {
    Object.values(GlossaryTermPropertyDatatype).forEach((datatype) =>
      expect(check(datatype, '')).toBeUndefined()
    );
  });

  it.each([
    [GlossaryTermPropertyDatatype.Integer, '365', undefined],
    [
      GlossaryTermPropertyDatatype.Integer,
      '3.5',
      'message.glossary-term-property-invalid-integer',
    ],
    [GlossaryTermPropertyDatatype.Decimal, '-99.95', undefined],
    [GlossaryTermPropertyDatatype.Decimal, '.5', undefined],
    [
      GlossaryTermPropertyDatatype.Decimal,
      '1e3',
      'message.glossary-term-property-invalid-number',
    ],
    [GlossaryTermPropertyDatatype.Boolean, 'true', undefined],
    [
      GlossaryTermPropertyDatatype.Boolean,
      'True',
      'message.glossary-term-property-invalid-boolean',
    ],
    [GlossaryTermPropertyDatatype.Date, '2026-11-12', undefined],
    [
      GlossaryTermPropertyDatatype.Date,
      '2026-02-30',
      'message.glossary-term-property-invalid-date',
    ],
    [GlossaryTermPropertyDatatype.DateTime, '2026-11-12T09:30:00Z', undefined],
    [
      GlossaryTermPropertyDatatype.DateTime,
      '2026-11-12',
      'message.glossary-term-property-invalid-date-time',
    ],
    [GlossaryTermPropertyDatatype.Enum, 'GDPR', undefined],
    [
      GlossaryTermPropertyDatatype.Enum,
      'HIPAA',
      'message.glossary-term-property-invalid-enum',
    ],
    [GlossaryTermPropertyDatatype.URL, 'https://example.com/a?b=1', undefined],
    [
      GlossaryTermPropertyDatatype.URL,
      'ftp://example.com',
      'message.url-must-use-http-or-https',
    ],
    [
      GlossaryTermPropertyDatatype.URL,
      'example.com',
      'message.url-must-use-http-or-https',
    ],
  ])('%s with %j gives %j', (datatype, value, expected) => {
    expect(check(datatype, value)).toBe(expected);
  });

  it('rejects a value over the server length limit', () => {
    expect(check(GlossaryTermPropertyDatatype.String, 'x'.repeat(2049))).toBe(
      'message.glossary-term-property-value-too-long'
    );
  });
});

describe('validatePropertyDraft', () => {
  const draft = {
    ...EMPTY_PROPERTY_DRAFT,
    displayName: 'Sla tier',
    datatype: GlossaryTermPropertyDatatype.Enum,
    enumValuesText: 'Gold, Silver',
  };

  it('passes a complete new enum property', () => {
    expect(
      validatePropertyDraft({ draft, mode: 'new', takenNames: [] })
    ).toEqual({});
  });

  it('flags a name that sanitizes to nothing', () => {
    expect(
      validatePropertyDraft({
        draft: { ...draft, displayName: '***' },
        mode: 'new',
        takenNames: [],
      }).displayName?.key
    ).toBe('message.glossary-term-property-name-required');
  });

  it('flags a name an own or inherited property already uses, ignoring case', () => {
    expect(
      validatePropertyDraft({
        draft,
        mode: 'new',
        takenNames: ['SLA TIER'],
      }).displayName?.key
    ).toBe('message.glossary-term-property-name-exists');
  });

  it('requires two allowed values for an enum', () => {
    expect(
      validatePropertyDraft({
        draft: { ...draft, enumValuesText: 'Gold' },
        mode: 'new',
        takenNames: [],
      }).enumValues?.key
    ).toBe('message.glossary-term-property-enum-minimum');
  });

  it('checks the value against the typed allowed values', () => {
    expect(
      validatePropertyDraft({
        draft: { ...draft, value: 'Bronze' },
        mode: 'new',
        takenNames: [],
      }).value?.key
    ).toBe('message.glossary-term-property-invalid-enum');
  });

  it('validates an override against the declaring term enum, not the draft', () => {
    expect(
      validatePropertyDraft({
        draft: { ...EMPTY_PROPERTY_DRAFT, value: 'HIPAA' },
        mode: 'override',
        takenNames: [],
        existing: scope,
      }).value?.key
    ).toBe('message.glossary-term-property-invalid-enum');
    expect(
      validatePropertyDraft({
        draft: { ...EMPTY_PROPERTY_DRAFT, value: 'CCPA' },
        mode: 'override',
        takenNames: [],
        existing: scope,
      })
    ).toEqual({});
  });
});

describe('buildPropertyDefinition', () => {
  it('derives the name from the label and leaves inheritable to the server', () => {
    expect(
      buildPropertyDefinition({
        ...EMPTY_PROPERTY_DRAFT,
        displayName: ' Sla / tier ',
        datatype: GlossaryTermPropertyDatatype.Enum,
        enumValuesText: 'Gold,Silver',
        description: ' The tier ',
      })
    ).toEqual({
      name: 'Sla tier',
      displayName: 'Sla / tier',
      datatype: 'enum',
      enumValues: ['Gold', 'Silver'],
      description: 'The tier',
    });
  });

  it('drops allowed values typed before the type changed away from enum', () => {
    expect(
      buildPropertyDefinition({
        ...EMPTY_PROPERTY_DRAFT,
        displayName: 'Owner',
        enumValuesText: 'a,b',
      })
    ).toEqual({ name: 'Owner', displayName: 'Owner', datatype: 'string' });
  });
});

describe('getPropertySource', () => {
  it('labels an own property as declared', () => {
    expect(
      getPropertySource(
        effective(retention, 'Customer', { termId: 'Customer' }),
        'Customer'
      )
    ).toEqual({ kind: 'declared' });
  });

  it('labels an untouched inherited property with its declaring term', () => {
    expect(
      getPropertySource(
        effective(scope, 'Customer', { valuesFrom: 'Customer' }),
        'Phone'
      )
    ).toEqual({ kind: 'inherited', from: 'Customer' });
  });

  it('labels an inherited property overridden on this term', () => {
    expect(
      getPropertySource(
        effective(scope, 'Customer', { valuesFrom: 'Phone' }),
        'Phone'
      )
    ).toEqual({ kind: 'overriddenHere', from: 'Customer' });
  });

  it('names the intermediate term whose entry supplies the value', () => {
    expect(
      getPropertySource(
        effective(scope, 'Customer', { valuesFrom: 'Phone' }),
        'Mobile'
      )
    ).toEqual({ kind: 'overriddenIn', from: 'Customer', in: 'Phone' });
  });

  it('treats an inherited property with no entry anywhere as inherited', () => {
    expect(getPropertySource(effective(scope, 'Customer'), 'Phone')).toEqual({
      kind: 'inherited',
      from: 'Customer',
    });
  });
});

describe('property lists', () => {
  const own = effective(retention, 'Phone', { termId: 'Phone' });
  const inherited = effective(scope, 'Customer');

  it('counts own and inherited entries', () => {
    expect(getPropertyCounts([inherited, own, own])).toEqual({
      own: 2,
      inherited: 1,
    });
    expect(getPropertyCounts(undefined)).toEqual({ own: 0, inherited: 0 });
  });

  it('lists own properties before inherited ones', () => {
    expect(sortEffectiveProperties([inherited, own])).toEqual([own, inherited]);
  });

  it('keeps only inheritable entries for a child term preview', () => {
    const notInheritable = effective(
      { ...retention, name: 'private', inheritable: false },
      'Customer'
    );

    expect(
      getInheritableEntries([inherited, notInheritable]).map(
        (entry) => entry.property.name
      )
    ).toEqual(['regulatoryScope']);
  });

  it('formats values with units and translated booleans', () => {
    const translate = (key: string) => `t:${key}`;

    expect(formatPropertyValue(retention, ['365'], translate)).toBe('365 days');
    expect(
      formatPropertyValue(
        { datatype: GlossaryTermPropertyDatatype.Boolean },
        ['true', 'false'],
        translate
      )
    ).toBe('t:label.true-value, t:label.false-value');
    expect(formatPropertyValue(retention, [], translate)).toBeUndefined();
  });
});

describe('patch builders', () => {
  it('adds the first definition and value as whole fields', () => {
    expect(buildAddPropertyPatch({}, retention, ['365'])).toEqual([
      { op: 'add', path: '/propertyDefinitions', value: [retention] },
      { op: 'add', path: '/propertyValues', value: { retentionDays: ['365'] } },
    ]);
  });

  it('appends a definition and sets its value key when maps exist', () => {
    expect(
      buildAddPropertyPatch(
        {
          propertyDefinitions: [scope],
          propertyValues: { regulatoryScope: ['GDPR'] },
        },
        retention,
        ['365']
      )
    ).toEqual([
      { op: 'add', path: '/propertyDefinitions/-', value: retention },
      { op: 'add', path: '/propertyValues/retentionDays', value: ['365'] },
    ]);
  });

  it('adds a definition without a value entry when no value was given', () => {
    expect(
      buildAddPropertyPatch({ propertyDefinitions: [scope] }, retention, [])
    ).toEqual([
      { op: 'add', path: '/propertyDefinitions/-', value: retention },
    ]);
  });

  it('edits a label behind a test on the definition name', () => {
    expect(
      buildEditPropertyPatch(
        { propertyDefinitions: [scope, retention] },
        'retentionDays',
        { ...retention, displayName: 'Retention' },
        []
      )
    ).toEqual([
      {
        op: 'test',
        path: '/propertyDefinitions/1/name',
        value: 'retentionDays',
      },
      {
        op: 'add',
        path: '/propertyDefinitions/1/displayName',
        value: 'Retention',
      },
    ]);
  });

  it('removes a cleared description and an emptied value on edit', () => {
    expect(
      buildEditPropertyPatch(
        {
          propertyDefinitions: [{ ...retention, description: 'old' }],
          propertyValues: { retentionDays: ['365'] },
        },
        'retentionDays',
        retention,
        []
      )
    ).toEqual([
      {
        op: 'test',
        path: '/propertyDefinitions/0/name',
        value: 'retentionDays',
      },
      { op: 'remove', path: '/propertyDefinitions/0/description' },
      { op: 'remove', path: '/propertyValues/retentionDays' },
    ]);
  });

  it('sends no operation when an edit changes nothing', () => {
    expect(
      buildEditPropertyPatch(
        {
          propertyDefinitions: [retention],
          propertyValues: { retentionDays: ['365'] },
        },
        'retentionDays',
        retention,
        ['365']
      )
    ).toEqual([]);
  });

  it('overrides with a value, and clears with an empty list', () => {
    expect(
      buildOverridePatch(
        { propertyValues: { other: ['x'] } },
        'regulatoryScope',
        ['CCPA']
      )
    ).toEqual([
      { op: 'add', path: '/propertyValues/regulatoryScope', value: ['CCPA'] },
    ]);
    expect(buildOverridePatch({}, 'regulatoryScope', [])).toEqual([
      { op: 'add', path: '/propertyValues', value: { regulatoryScope: [] } },
    ]);
  });

  it('resets by removing the key, and does nothing when there is no entry', () => {
    expect(
      buildResetPatch(
        { propertyValues: { regulatoryScope: ['CCPA'] } },
        'regulatoryScope'
      )
    ).toEqual([{ op: 'remove', path: '/propertyValues/regulatoryScope' }]);
    expect(buildResetPatch({ propertyValues: {} }, 'regulatoryScope')).toEqual(
      []
    );
    expect(buildResetPatch({}, 'regulatoryScope')).toEqual([]);
  });

  it('deletes a definition together with its own value entry', () => {
    expect(
      buildDeletePropertyPatch(
        {
          propertyDefinitions: [scope, retention],
          propertyValues: { retentionDays: ['365'], regulatoryScope: ['GDPR'] },
        },
        'retentionDays'
      )
    ).toEqual([
      {
        op: 'test',
        path: '/propertyDefinitions/1/name',
        value: 'retentionDays',
      },
      { op: 'remove', path: '/propertyValues/retentionDays' },
      { op: 'remove', path: '/propertyDefinitions/1' },
    ]);
  });

  it('builds nothing for a property the term does not declare', () => {
    expect(
      buildDeletePropertyPatch({ propertyDefinitions: [scope] }, 'nope')
    ).toEqual([]);
  });
});

describe('create form rows', () => {
  const row = (
    changes: Partial<GlossaryTermPropertyRow>
  ): GlossaryTermPropertyRow => ({
    ...EMPTY_PROPERTY_DRAFT,
    rowId: changes.displayName ?? 'row',
    ...changes,
  });

  it('builds definitions and only the values that were filled in', () => {
    expect(
      buildCreatePropertyFields([
        row({ displayName: 'Owner team', value: 'Payments' }),
        row({
          displayName: 'Sla tier',
          datatype: GlossaryTermPropertyDatatype.Enum,
          enumValuesText: 'Gold, Silver',
        }),
        row({}),
      ])
    ).toEqual({
      propertyDefinitions: [
        { name: 'Owner team', displayName: 'Owner team', datatype: 'string' },
        {
          name: 'Sla tier',
          displayName: 'Sla tier',
          datatype: 'enum',
          enumValues: ['Gold', 'Silver'],
        },
      ],
      propertyValues: { 'Owner team': ['Payments'] },
    });
  });

  it('sends overridden inherited values beside the new rows and drops blank overrides', () => {
    const inherited = [
      { property: { name: 'region', datatype: 'string' } },
      { property: { name: 'tier', datatype: 'string' } },
    ] as unknown as InheritedPropertyEntry[];

    expect(
      buildCreatePropertyFields(
        [row({ displayName: 'Owner team', value: 'Payments' })],
        { region: 'EU', tier: '' },
        inherited
      )
    ).toEqual({
      propertyDefinitions: [
        { name: 'Owner team', displayName: 'Owner team', datatype: 'string' },
      ],
      propertyValues: { region: ['EU'], 'Owner team': ['Payments'] },
    });
    expect(buildCreatePropertyFields([], { region: 'EU' }, inherited)).toEqual({
      propertyValues: { region: ['EU'] },
    });
  });

  it('sends nothing for untouched rows', () => {
    expect(buildCreatePropertyFields([row({})])).toEqual({});
  });

  it('flags duplicates between rows and against inherited names, skipping blank rows', () => {
    const errors = validatePropertyRows(
      [
        row({ displayName: 'Owner team', rowId: 'a' }),
        row({ displayName: 'owner team', rowId: 'b' }),
        row({ displayName: 'Regulatory scope', rowId: 'c' }),
        row({ rowId: 'blank' }),
      ],
      ['Regulatory scope']
    );

    expect(Object.keys(errors).sort()).toEqual(['b', 'c']);
    expect(errors.b.displayName?.key).toBe(
      'message.glossary-term-property-name-exists'
    );
  });
});
