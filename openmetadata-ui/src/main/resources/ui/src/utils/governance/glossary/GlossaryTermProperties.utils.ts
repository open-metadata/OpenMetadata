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

import { compare, Operation } from 'fast-json-patch';
import { isEmpty, isEqual, uniq } from 'lodash';
import {
  CreateGlossaryTerm,
  GlossaryTermProperty,
} from '../../../generated/api/data/createGlossaryTerm';
import { EffectiveGlossaryTermProperty } from '../../../generated/entity/data/glossaryTerm';
import { GlossaryTermPropertyDatatype } from '../../../generated/type/glossaryTermProperty';
import {
  PROPERTY_MAX_MULTI_VALUES,
  PROPERTY_MAX_NAME_LENGTH,
  PROPERTY_MAX_VALUE_LENGTH,
  PROPERTY_MIN_ENUM_VALUES,
} from './GlossaryTermProperties.constants';
import {
  GlossaryTermPropertyCounts,
  GlossaryTermPropertyDraft,
  GlossaryTermPropertyDraftErrors,
  GlossaryTermPropertyError,
  GlossaryTermPropertyMode,
  GlossaryTermPropertyRow,
  GlossaryTermPropertySource,
  GlossaryTermWithProperties,
  InheritedPropertyEntry,
} from './GlossaryTermProperties.types';

// Characters basic.json#/customPropertyName rejects. Anything else it allows stays.
const DISALLOWED_NAME_CHARS = /[^A-Za-z0-9 _\-.,;%#@!'(){}[\]|=+?`]/g;
const INTEGER_PATTERN = /^[+-]?\d+$/;
const DECIMAL_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;

export const EMPTY_PROPERTY_DRAFT: GlossaryTermPropertyDraft = {
  displayName: '',
  datatype: GlossaryTermPropertyDatatype.String,
  enumValuesText: '',
  value: '',
  description: '',
};

/** Derives the stored name from the label: drops what the name pattern rejects and any leading symbol. */
export const sanitizePropertyName = (displayName: string): string =>
  displayName
    .replace(DISALLOWED_NAME_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^A-Za-z0-9]+/, '')
    .slice(0, PROPERTY_MAX_NAME_LENGTH)
    .trim();

export const parseEnumValues = (text: string): string[] =>
  uniq(
    text
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value !== '')
  );

const isValidDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  );
};

export const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);

    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

const VALUE_ERROR_KEYS: Partial<Record<GlossaryTermPropertyDatatype, string>> =
  {
    [GlossaryTermPropertyDatatype.Integer]:
      'message.glossary-term-property-invalid-integer',
    [GlossaryTermPropertyDatatype.Decimal]:
      'message.glossary-term-property-invalid-number',
    [GlossaryTermPropertyDatatype.Boolean]:
      'message.glossary-term-property-invalid-boolean',
    [GlossaryTermPropertyDatatype.Date]:
      'message.glossary-term-property-invalid-date',
    [GlossaryTermPropertyDatatype.DateTime]:
      'message.glossary-term-property-invalid-date-time',
    [GlossaryTermPropertyDatatype.Enum]:
      'message.glossary-term-property-invalid-enum',
    [GlossaryTermPropertyDatatype.URL]: 'message.url-must-use-http-or-https',
  };

const isLexicallyValid = (
  property: Pick<GlossaryTermProperty, 'datatype' | 'enumValues'>,
  value: string
): boolean => {
  switch (property.datatype) {
    case GlossaryTermPropertyDatatype.Integer:
      return INTEGER_PATTERN.test(value);
    case GlossaryTermPropertyDatatype.Decimal:
      return DECIMAL_PATTERN.test(value);
    case GlossaryTermPropertyDatatype.Boolean:
      return value === 'true' || value === 'false';
    case GlossaryTermPropertyDatatype.Date:
      return isValidDate(value);
    case GlossaryTermPropertyDatatype.DateTime:
      return DATE_TIME_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
    case GlossaryTermPropertyDatatype.Enum:
      return Boolean(property.enumValues?.includes(value));
    case GlossaryTermPropertyDatatype.URL:
      return isHttpUrl(value);
    default:
      return true;
  }
};

/** Checks one value the way the server checks its lexical form; undefined means valid. */
export const validatePropertyValue = (
  property: Pick<GlossaryTermProperty, 'datatype' | 'enumValues'>,
  value: string
): GlossaryTermPropertyError | undefined => {
  if (value === '') {
    return undefined;
  }
  if (value.length > PROPERTY_MAX_VALUE_LENGTH) {
    return {
      key: 'message.glossary-term-property-value-too-long',
      values: { max: PROPERTY_MAX_VALUE_LENGTH },
    };
  }
  const key = VALUE_ERROR_KEYS[property.datatype];

  return key && !isLexicallyValid(property, value) ? { key } : undefined;
};

/** Splits typed text into the stored list: one value, or a comma list for a multi-valued property. */
export const toPropertyValues = (
  property: Pick<GlossaryTermProperty, 'multiValued'>,
  text: string
): string[] => {
  if (text.trim() === '') {
    return [];
  }

  return property.multiValued ? parseEnumValues(text) : [text];
};

export const fromPropertyValues = (
  property: Pick<GlossaryTermProperty, 'multiValued'>,
  values: string[] = []
): string => (property.multiValued ? values.join(', ') : values[0] ?? '');

const validateValues = (
  property: Pick<
    GlossaryTermProperty,
    'datatype' | 'enumValues' | 'multiValued'
  >,
  text: string
): GlossaryTermPropertyError | undefined => {
  const values = toPropertyValues(property, text);
  if (values.length > PROPERTY_MAX_MULTI_VALUES) {
    return {
      key: 'message.glossary-term-property-too-many-values',
      values: { max: PROPERTY_MAX_MULTI_VALUES },
    };
  }

  return values
    .map((value) => validatePropertyValue(property, value))
    .find(Boolean);
};

interface ValidateDraftParams {
  draft: GlossaryTermPropertyDraft;
  mode: GlossaryTermPropertyMode;
  /** Names taken by the term's own and inherited properties, compared ignoring case. */
  takenNames: string[];
  /** The definition being edited or overridden; its datatype and enum win over the draft. */
  existing?: GlossaryTermProperty;
}

const validateDraftName = (
  draft: GlossaryTermPropertyDraft,
  mode: GlossaryTermPropertyMode,
  takenNames: string[]
): GlossaryTermPropertyError | undefined => {
  if (mode === 'override') {
    return undefined;
  }
  const name = sanitizePropertyName(draft.displayName);
  if (isEmpty(name)) {
    return { key: 'message.glossary-term-property-name-required' };
  }
  const isTaken = takenNames.some(
    (taken) => taken.toLowerCase() === name.toLowerCase()
  );

  return mode === 'new' && isTaken
    ? { key: 'message.glossary-term-property-name-exists' }
    : undefined;
};

const validateDraftEnum = (
  datatype: GlossaryTermPropertyDatatype,
  enumValues: string[] | undefined,
  mode: GlossaryTermPropertyMode
): GlossaryTermPropertyError | undefined => {
  if (mode === 'override' || datatype !== GlossaryTermPropertyDatatype.Enum) {
    return undefined;
  }

  return (enumValues?.length ?? 0) < PROPERTY_MIN_ENUM_VALUES
    ? {
        key: 'message.glossary-term-property-enum-minimum',
        values: { min: PROPERTY_MIN_ENUM_VALUES },
      }
    : undefined;
};

export const validatePropertyDraft = ({
  draft,
  mode,
  takenNames,
  existing,
}: ValidateDraftParams): GlossaryTermPropertyDraftErrors => {
  const datatype = existing?.datatype ?? draft.datatype;
  const enumValues =
    mode === 'override' && existing
      ? existing.enumValues
      : parseEnumValues(draft.enumValuesText);

  const errors: GlossaryTermPropertyDraftErrors = {};
  const nameError = validateDraftName(draft, mode, takenNames);
  const enumError = validateDraftEnum(datatype, enumValues, mode);
  const valueError = validateValues(
    { datatype, enumValues, multiValued: existing?.multiValued },
    draft.value
  );
  if (nameError) {
    errors.displayName = nameError;
  }
  if (enumError) {
    errors.enumValues = enumError;
  }
  if (valueError) {
    errors.value = valueError;
  }

  return errors;
};

/** Builds the definition the server stores; `inheritable` is left to the server default. */
export const buildPropertyDefinition = (
  draft: GlossaryTermPropertyDraft
): GlossaryTermProperty => {
  const displayName = draft.displayName.trim();
  const description = draft.description.trim();

  return {
    name: sanitizePropertyName(draft.displayName),
    ...(displayName ? { displayName } : {}),
    datatype: draft.datatype,
    ...(draft.datatype === GlossaryTermPropertyDatatype.Enum
      ? { enumValues: parseEnumValues(draft.enumValuesText) }
      : {}),
    ...(description ? { description } : {}),
  };
};

export const getPropertyLabel = (property: GlossaryTermProperty): string =>
  property.displayName || property.name;

export const isOverriddenHere = (
  entry: EffectiveGlossaryTermProperty,
  termId: string
): boolean => entry.inherited && entry.valuesFrom?.id === termId;

export const getPropertySource = (
  entry: EffectiveGlossaryTermProperty,
  termId: string
): GlossaryTermPropertySource => {
  const from = entry.declaredBy.displayName || entry.declaredBy.name || '';
  if (!entry.inherited) {
    return { kind: 'declared' };
  }
  if (isOverriddenHere(entry, termId)) {
    return { kind: 'overriddenHere', from };
  }
  const { valuesFrom } = entry;
  if (valuesFrom && valuesFrom.id !== entry.declaredBy.id) {
    return {
      kind: 'overriddenIn',
      from,
      in: valuesFrom.displayName || valuesFrom.name || '',
    };
  }

  return { kind: 'inherited', from };
};

export const getPropertyCounts = (
  effectiveProperties: EffectiveGlossaryTermProperty[] = []
): GlossaryTermPropertyCounts => {
  const inherited = effectiveProperties.filter(
    (entry) => entry.inherited
  ).length;

  return { own: effectiveProperties.length - inherited, inherited };
};

/** Own properties first, each group in the order the server returned. */
export const sortEffectiveProperties = (
  effectiveProperties: EffectiveGlossaryTermProperty[] = []
): EffectiveGlossaryTermProperty[] => [
  ...effectiveProperties.filter((entry) => !entry.inherited),
  ...effectiveProperties.filter((entry) => entry.inherited),
];

/** Properties a new child term would inherit from the parent's effective list. */
export const getInheritableEntries = (
  effectiveProperties: EffectiveGlossaryTermProperty[] = []
): InheritedPropertyEntry[] =>
  effectiveProperties
    .filter((entry) => entry.property.inheritable !== false)
    .map(({ property, declaredBy, values }) => ({
      property,
      declaredBy,
      values,
    }));

/** The stored values as one display string; undefined when the property has no value here. */
const getBooleanLabelKey = (value: string): string =>
  value === 'true' ? 'label.true-value' : 'label.false-value';

export const formatPropertyValue = (
  property: Pick<GlossaryTermProperty, 'datatype' | 'unit'>,
  values: string[],
  translate: (key: string) => string
): string | undefined => {
  if (values.length === 0) {
    return undefined;
  }
  const isBoolean = property.datatype === GlossaryTermPropertyDatatype.Boolean;
  const text = values
    .map((value) => (isBoolean ? translate(getBooleanLabelKey(value)) : value))
    .join(', ');

  return property.unit ? `${text} ${property.unit}` : text;
};

export const getTermPropertyNames = (
  term: Pick<GlossaryTermWithProperties, 'effectiveProperties'>
): string[] =>
  (term.effectiveProperties ?? []).map((entry) => entry.property.name);

const valuePath = (name: string) => `/propertyValues/${name}`;

/** A value operation: `undefined` resets the key, a list (possibly empty) sets it. */
const buildValueOperations = (
  term: Pick<GlossaryTermWithProperties, 'propertyValues'>,
  name: string,
  values: string[] | undefined
): Operation[] => {
  if (values === undefined) {
    return term.propertyValues && name in term.propertyValues
      ? [{ op: 'remove', path: valuePath(name) }]
      : [];
  }
  if (!term.propertyValues) {
    return [{ op: 'add', path: '/propertyValues', value: { [name]: values } }];
  }

  return [{ op: 'add', path: valuePath(name), value: values }];
};

const definitionIndex = (
  term: Pick<GlossaryTermWithProperties, 'propertyDefinitions'>,
  name: string
): number =>
  (term.propertyDefinitions ?? []).findIndex(
    (definition) => definition.name === name
  );

/** Guards an index-addressed edit: the server rejects the patch when the list moved. */
const guardDefinition = (
  term: Pick<GlossaryTermWithProperties, 'propertyDefinitions'>,
  index: number
): Operation => ({
  op: 'test',
  path: `/propertyDefinitions/${index}/name`,
  value: term.propertyDefinitions?.[index]?.name,
});

export const buildAddPropertyPatch = (
  term: Pick<
    GlossaryTermWithProperties,
    'propertyDefinitions' | 'propertyValues'
  >,
  definition: GlossaryTermProperty,
  values: string[]
): Operation[] => [
  term.propertyDefinitions
    ? { op: 'add', path: '/propertyDefinitions/-', value: definition }
    : { op: 'add', path: '/propertyDefinitions', value: [definition] },
  ...(values.length > 0
    ? buildValueOperations(term, definition.name, values)
    : []),
];

/** Edits the label, description and allowed values; the name and datatype never change. */
export const buildEditPropertyPatch = (
  term: Pick<
    GlossaryTermWithProperties,
    'propertyDefinitions' | 'propertyValues'
  >,
  name: string,
  updated: GlossaryTermProperty,
  values: string[]
): Operation[] => {
  const index = definitionIndex(term, name);
  const current = term.propertyDefinitions?.[index];
  if (!current) {
    return [];
  }
  const definitionOps = compare(current, updated).map((operation) => ({
    ...operation,
    path: `/propertyDefinitions/${index}${operation.path}`,
  }));
  const currentValues = term.propertyValues?.[name] ?? [];
  const nextValues = values.length > 0 ? values : undefined;
  const valueOps = isEqual(currentValues, values)
    ? []
    : buildValueOperations(term, name, nextValues);

  return [
    ...(definitionOps.length > 0 ? [guardDefinition(term, index)] : []),
    ...definitionOps,
    ...valueOps,
  ];
};

/**
 * Override sets this term's own entry. An empty list is an explicit "no value" that the
 * terms below inherit; `reset` removes the entry so the term inherits again.
 */
export const buildOverridePatch = (
  term: Pick<GlossaryTermWithProperties, 'propertyValues'>,
  name: string,
  values: string[]
): Operation[] => buildValueOperations(term, name, values);

export const buildResetPatch = (
  term: Pick<GlossaryTermWithProperties, 'propertyValues'>,
  name: string
): Operation[] => buildValueOperations(term, name, undefined);

/** Removes the definition together with this term's own entry, which would otherwise name no property. */
export const buildDeletePropertyPatch = (
  term: Pick<
    GlossaryTermWithProperties,
    'propertyDefinitions' | 'propertyValues'
  >,
  name: string
): Operation[] => {
  const index = definitionIndex(term, name);
  if (index < 0) {
    return [];
  }

  return [
    guardDefinition(term, index),
    ...buildValueOperations(term, name, undefined),
    { op: 'remove', path: `/propertyDefinitions/${index}` },
  ];
};

/** True when a patch addresses definitions by index, so a stale list can break it. */
export const patchGuardsDefinitions = (patch: Operation[]): boolean =>
  patch.some((operation) => operation.op === 'test');

export const newPropertyRow = (rowId: string): GlossaryTermPropertyRow => ({
  ...EMPTY_PROPERTY_DRAFT,
  rowId,
});

// An untouched row is ignored on submit instead of blocking it.
const isFilledRow = (row: GlossaryTermPropertyRow): boolean =>
  [row.displayName, row.value, row.enumValuesText, row.description].some(
    (text) => text.trim() !== ''
  );

/**
 * The create request's property fields from the form rows and the values the term overrides
 * on inherited properties; blank rows and blank overrides are dropped.
 */
export const buildCreatePropertyFields = (
  rows: GlossaryTermPropertyRow[],
  inheritedValues: Record<string, string> = {},
  inherited: InheritedPropertyEntry[] = []
): Pick<CreateGlossaryTerm, 'propertyDefinitions' | 'propertyValues'> => {
  const filled = rows.filter(isFilledRow);
  const propertyDefinitions = filled.map(buildPropertyDefinition);
  const overriddenValues = inherited.flatMap(({ property }) => {
    const values = toPropertyValues(
      property,
      inheritedValues[property.name] ?? ''
    );

    return values.length > 0 ? [[property.name, values] as const] : [];
  });
  const ownValues = filled
    .map(
      (row, index) =>
        [
          propertyDefinitions[index].name,
          toPropertyValues(propertyDefinitions[index], row.value),
        ] as const
    )
    .filter(([, values]) => values.length > 0);
  const propertyValues = Object.fromEntries([
    ...overriddenValues,
    ...ownValues,
  ]);

  return {
    ...(propertyDefinitions.length > 0 ? { propertyDefinitions } : {}),
    ...(isEmpty(propertyValues) ? {} : { propertyValues }),
  };
};

/** Row-level errors for the create form, keyed by rowId. */
export const validatePropertyRows = (
  rows: GlossaryTermPropertyRow[],
  inheritedNames: string[]
): Record<string, GlossaryTermPropertyDraftErrors> => {
  const taken = [...inheritedNames];
  const errors: Record<string, GlossaryTermPropertyDraftErrors> = {};

  rows.filter(isFilledRow).forEach((row) => {
    const rowErrors = validatePropertyDraft({
      draft: row,
      mode: 'new',
      takenNames: taken,
    });
    taken.push(sanitizePropertyName(row.displayName));
    if (!isEmpty(rowErrors)) {
      errors[row.rowId] = rowErrors;
    }
  });

  return errors;
};

/** Errors for the values a create form overrides on inherited properties, keyed by property name. */
export const validateInheritedValues = (
  inherited: InheritedPropertyEntry[],
  inheritedValues: Record<string, string>
): Record<string, GlossaryTermPropertyError> =>
  Object.fromEntries(
    inherited.flatMap(({ property }) => {
      const error = validateValues(
        property,
        inheritedValues[property.name] ?? ''
      );

      return error ? [[property.name, error] as const] : [];
    })
  );
