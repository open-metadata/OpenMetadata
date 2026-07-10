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
import { startCase } from 'lodash';
import type { CSSProperties } from 'react';
import { SEMICOLON_SPLITTER } from '../../../../constants/regex.constants';
import { reduceColorOpacity } from '../../../../utils/ColorUtils';
import Fqn from '../../../../utils/Fqn';
import { removeOuterEscapes } from '../../../../utils/StringUtils';
import './csv-cell-preview.less';

const CHIP_VARIANT_BY_COLUMN: Record<string, string> = {
  tags: 'tag',
  glossaryTerms: 'glossary',
  tiers: 'tier',
  relatedTerms: 'glossary',
  domains: 'domain',
  dataProducts: 'product',
  extension: 'prop',
  relatedMetrics: 'metric',
};

const CHIP_FALLBACK_COLORS: Record<string, string> = {
  tags: '#5925dc',
  glossaryTerms: '#1570ef',
  relatedTerms: '#1570ef',
  domains: '#1570ef',
  dataProducts: '#1570ef',
  tiers: '#5925dc',
};

const AVATAR_COLUMNS = ['owners', 'owner', 'reviewers'];
const HIERARCHY_SEPARATOR = ' / ';

const AVATAR_PALETTE = [
  'avatar-0',
  'avatar-1',
  'avatar-2',
  'avatar-3',
  'avatar-4',
  'avatar-5',
];

const getAvatarClass = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash + seed.charCodeAt(i)) % AVATAR_PALETTE.length;
  }

  return AVATAR_PALETTE[hash];
};

const getInitials = (label: string) => {
  const parts = label.replace(/[_-]/g, ' ').split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  return label.slice(0, 2).toUpperCase();
};

const isHexColor = (color: string) =>
  /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color);

const getChipStyle = (
  column: string,
  item: string,
  itemStyles?: Record<string, string>
): CSSProperties | undefined => {
  const color = itemStyles?.[item] ?? CHIP_FALLBACK_COLORS[column];

  if (!color) {
    return undefined;
  }

  return {
    backgroundColor: isHexColor(color)
      ? reduceColorOpacity(color, 0.08)
      : undefined,
    color,
  };
};

// Owner/reviewer values are serialized as "type:name" (e.g. "user:admin",
// "team:Finance"); show the readable name with an initial avatar.
const parseEntity = (raw: string) => {
  const [type, name] = raw.split(':');
  const label = name ?? type;

  return { type: name ? type : 'user', label };
};

const getGlossaryTermLabel = (item: string) => {
  try {
    const hierarchy = Fqn.split(item).filter(Boolean);

    return hierarchy.length > 1 ? hierarchy.join(HIERARCHY_SEPARATOR) : item;
  } catch {
    return item;
  }
};

const parseCustomPropertyItems = (value: string) =>
  (value ?? '')
    .split(SEMICOLON_SPLITTER)
    .map(removeOuterEscapes)
    .map((item) => {
      const [key, ...valueParts] = item.split(':');
      const customPropertyValue = removeOuterEscapes(
        valueParts.join(':').trim()
      );

      return {
        key: key.trim(),
        label: startCase(key.trim()),
        value: customPropertyValue,
      };
    })
    .filter(({ key, value }) => key && value);

export interface CsvCellPreviewProps {
  column: string;
  itemStyles?: Record<string, string>;
  value: string;
}

const CsvCellPreview = ({ column, itemStyles, value }: CsvCellPreviewProps) => {
  const items = (value ?? '')
    .split(';')
    .map((item) => removeOuterEscapes(item.trim()))
    .filter(Boolean);

  let content = <span className="csv-cell-empty">—</span>;

  if (column === 'extension') {
    const customPropertyItems = parseCustomPropertyItems(value);

    if (customPropertyItems.length) {
      content = (
        <div className="csv-cell-chips csv-cell-chips-custom-properties">
          {customPropertyItems.map((item) => (
            <span
              className="csv-chip csv-chip-prop"
              key={item.key}
              title={`${item.label}: ${item.value}`}>
              {item.label}: <span className="csv-chip-value">{item.value}</span>
            </span>
          ))}
        </div>
      );
    }
  } else if (items.length && AVATAR_COLUMNS.includes(column)) {
    content = (
      <div className="csv-cell-chips">
        {items.map((item) => {
          const { label } = parseEntity(item);

          return (
            <span className="csv-owner-chip" key={item} title={label}>
              <span className={`csv-owner-avatar ${getAvatarClass(label)}`}>
                {getInitials(label)}
              </span>
              <span className="csv-owner-name">{label}</span>
            </span>
          );
        })}
      </div>
    );
  } else if (items.length) {
    const variant = CHIP_VARIANT_BY_COLUMN[column] ?? 'default';
    content = (
      <div className="csv-cell-chips">
        {items.map((item) => {
          const label =
            column === 'glossaryTerms' ? getGlossaryTermLabel(item) : item;

          return (
            <span
              className={`csv-chip csv-chip-${variant}`}
              key={item}
              style={getChipStyle(column, item, itemStyles)}
              title={item}>
              {label}
            </span>
          );
        })}
      </div>
    );
  }

  return content;
};

export default CsvCellPreview;
