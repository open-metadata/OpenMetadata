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
import './csv-cell-preview.less';

const CHIP_VARIANT_BY_COLUMN: Record<string, string> = {
  tags: 'tag',
  glossaryTerms: 'glossary',
  relatedTerms: 'glossary',
  domains: 'domain',
  dataProducts: 'product',
  relatedMetrics: 'metric',
};

const AVATAR_COLUMNS = ['owners', 'owner', 'reviewers'];

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

// Owner/reviewer values are serialized as "type:name" (e.g. "user:admin",
// "team:Finance"); show the readable name with an initial avatar.
const parseEntity = (raw: string) => {
  const [type, name] = raw.split(':');
  const label = name ?? type;

  return { type: name ? type : 'user', label };
};

export interface CsvCellPreviewProps {
  column: string;
  value: string;
}

const CsvCellPreview = ({ column, value }: CsvCellPreviewProps) => {
  const items = (value ?? '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);

  let content = <span className="csv-cell-empty">—</span>;

  if (items.length && AVATAR_COLUMNS.includes(column)) {
    content = (
      <div className="csv-cell-chips">
        {items.map((item) => {
          const { label } = parseEntity(item);

          return (
            <span className="csv-owner-chip" key={item} title={label}>
              <span className={`csv-owner-avatar ${getAvatarClass(label)}`}>
                {label.charAt(0).toUpperCase()}
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
        {items.map((item) => (
          <span
            className={`csv-chip csv-chip-${variant}`}
            key={item}
            title={item}>
            {item}
          </span>
        ))}
      </div>
    );
  }

  return content;
};

export default CsvCellPreview;
