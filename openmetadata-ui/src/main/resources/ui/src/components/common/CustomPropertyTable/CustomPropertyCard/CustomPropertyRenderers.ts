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
  HYPERLINK_TYPE_CUSTOM_PROPERTY,
  TABLE_TYPE_CUSTOM_PROPERTY,
} from '../../../../constants/CustomProperty.constants';
import { CustomPropertyRenderer } from './CustomPropertyCard.types';
import { datePropertyRenderer } from './renderers/DatePropertyValue';
import { entityReferencePropertyRenderer } from './renderers/EntityReferencePropertyValue';
import { enumPropertyRenderer } from './renderers/EnumPropertyValue';
import { hyperlinkPropertyRenderer } from './renderers/HyperlinkPropertyValue';
import { markdownPropertyRenderer } from './renderers/MarkdownPropertyValue';
import { sqlPropertyRenderer } from './renderers/SqlPropertyValue';
import { tablePropertyRenderer } from './renderers/TablePropertyValue';
import { textPropertyRenderer } from './renderers/TextPropertyValue';
import { timeIntervalPropertyRenderer } from './renderers/TimeIntervalPropertyValue';

const PROPERTY_RENDERERS: Record<string, CustomPropertyRenderer> = {
  string: textPropertyRenderer,
  integer: textPropertyRenderer,
  number: textPropertyRenderer,
  email: textPropertyRenderer,
  timestamp: textPropertyRenderer,
  duration: textPropertyRenderer,
  'date-cp': datePropertyRenderer,
  'dateTime-cp': datePropertyRenderer,
  'time-cp': datePropertyRenderer,
  enum: enumPropertyRenderer,
  [HYPERLINK_TYPE_CUSTOM_PROPERTY]: hyperlinkPropertyRenderer,
  entityReference: entityReferencePropertyRenderer,
  entityReferenceList: entityReferencePropertyRenderer,
  timeInterval: timeIntervalPropertyRenderer,
  [TABLE_TYPE_CUSTOM_PROPERTY]: tablePropertyRenderer,
  sqlQuery: sqlPropertyRenderer,
  markdown: markdownPropertyRenderer,
};

export const getPropertyRenderer = (
  propertyTypeName?: string
): CustomPropertyRenderer =>
  PROPERTY_RENDERERS[propertyTypeName ?? ''] ?? textPropertyRenderer;
