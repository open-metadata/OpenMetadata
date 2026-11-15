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
  Calendar,
  CheckCircle,
  Link01,
  List,
} from '@openmetadata/ui-core-components/icons';
import { ComponentType, SVGProps } from 'react';
import { GlossaryTermPropertyDatatype } from '../../../generated/type/glossaryTermProperty';

/** The types the picker offers, in the design's order, with the datatype each one stores. */
export const PROPERTY_TYPE_OPTIONS = [
  { datatype: GlossaryTermPropertyDatatype.String, labelKey: 'label.text' },
  { datatype: GlossaryTermPropertyDatatype.Decimal, labelKey: 'label.number' },
  { datatype: GlossaryTermPropertyDatatype.Date, labelKey: 'label.date' },
  {
    datatype: GlossaryTermPropertyDatatype.Boolean,
    labelKey: 'label.boolean',
  },
  { datatype: GlossaryTermPropertyDatatype.Enum, labelKey: 'label.enum' },
  { datatype: GlossaryTermPropertyDatatype.URL, labelKey: 'label.url' },
] as const;

/** Every datatype the server accepts, including the ones only the API creates. */
export const PROPERTY_DATATYPE_LABEL_KEYS: Record<
  GlossaryTermPropertyDatatype,
  string
> = {
  [GlossaryTermPropertyDatatype.String]: 'label.text',
  [GlossaryTermPropertyDatatype.Integer]: 'label.number',
  [GlossaryTermPropertyDatatype.Decimal]: 'label.number',
  [GlossaryTermPropertyDatatype.Boolean]: 'label.boolean',
  [GlossaryTermPropertyDatatype.Date]: 'label.date',
  [GlossaryTermPropertyDatatype.DateTime]: 'label.date-time',
  [GlossaryTermPropertyDatatype.Enum]: 'label.enum',
  [GlossaryTermPropertyDatatype.URL]: 'label.url',
};

export const PROPERTY_MAX_NAME_LENGTH = 256;
export const PROPERTY_MAX_VALUE_LENGTH = 2048;
export const PROPERTY_MIN_ENUM_VALUES = 2;
export const PROPERTY_MAX_MULTI_VALUES = 100;
// Mirrors the server's cap on definitions per term.
export const PROPERTY_MAX_DEFINITIONS = 50;
// The server rebuilds a stale definition-index patch at most this many times.
export const PROPERTY_PATCH_MAX_RETRIES = 3;

export const PROPERTY_VALUE_PLACEHOLDERS: Partial<
  Record<GlossaryTermPropertyDatatype, string>
> = {
  [GlossaryTermPropertyDatatype.URL]: 'https://',
  [GlossaryTermPropertyDatatype.DateTime]: 'YYYY-MM-DDThh:mm:ssZ',
};

export interface PropertyTypeAppearance {
  /** Text glyph shown in the tile; types without one use `icon`. */
  glyph?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  tileClassName: string;
}

const TEXT_TILE = 'tw:bg-utility-purple-50 tw:text-utility-purple-700';
const NUMBER_TILE = 'tw:bg-utility-blue-50 tw:text-utility-blue-700';
const DATE_TILE = 'tw:bg-utility-orange-50 tw:text-utility-orange-700';

/** One tile per type; integer and decimal read as one "Number" type. */
export const PROPERTY_TYPE_APPEARANCE: Record<
  GlossaryTermPropertyDatatype,
  PropertyTypeAppearance
> = {
  [GlossaryTermPropertyDatatype.String]: {
    glyph: 'Aa',
    tileClassName: TEXT_TILE,
  },
  [GlossaryTermPropertyDatatype.Integer]: {
    glyph: '#',
    tileClassName: NUMBER_TILE,
  },
  [GlossaryTermPropertyDatatype.Decimal]: {
    glyph: '#',
    tileClassName: NUMBER_TILE,
  },
  [GlossaryTermPropertyDatatype.Date]: {
    icon: Calendar,
    tileClassName: DATE_TILE,
  },
  [GlossaryTermPropertyDatatype.DateTime]: {
    icon: Calendar,
    tileClassName: DATE_TILE,
  },
  [GlossaryTermPropertyDatatype.Boolean]: {
    icon: CheckCircle,
    tileClassName: 'tw:bg-utility-success-50 tw:text-utility-success-700',
  },
  [GlossaryTermPropertyDatatype.Enum]: {
    icon: List,
    tileClassName: 'tw:bg-utility-indigo-50 tw:text-utility-indigo-700',
  },
  [GlossaryTermPropertyDatatype.URL]: {
    icon: Link01,
    tileClassName: 'tw:bg-utility-blue-light-50 tw:text-utility-blue-light-700',
  },
};
