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

import {
  EffectiveGlossaryTermProperty,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import {
  GlossaryTermProperty,
  GlossaryTermPropertyDatatype,
} from '../../../generated/type/glossaryTermProperty';

export type GlossaryTermPropertyMode = 'new' | 'edit' | 'override';

/** The slice of a term the property logic reads and patches. */
export type GlossaryTermWithProperties = Pick<
  GlossaryTerm,
  | 'id'
  | 'name'
  | 'fullyQualifiedName'
  | 'propertyDefinitions'
  | 'propertyValues'
  | 'effectiveProperties'
>;

/** Form state of one property; every field is the text the user typed or picked. */
export interface GlossaryTermPropertyDraft {
  displayName: string;
  datatype: GlossaryTermPropertyDatatype;
  enumValuesText: string;
  value: string;
  description: string;
}

/** An i18n key with its interpolation values, so the pure logic never needs `t`. */
export interface GlossaryTermPropertyError {
  key: string;
  values?: Record<string, string | number>;
}

export type GlossaryTermPropertyDraftErrors = Partial<
  Record<'displayName' | 'enumValues' | 'value', GlossaryTermPropertyError>
>;

export type GlossaryTermPropertySource =
  | { kind: 'declared' }
  | { kind: 'inherited'; from: string }
  | { kind: 'overriddenHere'; from: string }
  | { kind: 'overriddenIn'; from: string; in: string };

export interface GlossaryTermPropertyCounts {
  own: number;
  inherited: number;
}

/** A row of the create form: a property the new term declares. */
export interface GlossaryTermPropertyRow extends GlossaryTermPropertyDraft {
  rowId: string;
}

export type InheritedPropertyEntry = Pick<
  EffectiveGlossaryTermProperty,
  'property' | 'declaredBy' | 'values'
>;

export interface GlossaryTermPropertyValueInputProps {
  property: Pick<
    GlossaryTermProperty,
    'datatype' | 'enumValues' | 'multiValued'
  >;
  value: string;
  label: string;
  error?: GlossaryTermPropertyError;
  testId: string;
  onChange: (value: string) => void;
}

export interface GlossaryTermPropertyValueFieldProps
  extends GlossaryTermPropertyValueInputProps {
  errorMessage?: string;
}
