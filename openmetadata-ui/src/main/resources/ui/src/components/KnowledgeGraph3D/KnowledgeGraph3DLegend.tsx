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

import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LEGEND_TYPES,
  LINK_ONTOLOGY_COLOR,
  LINK_TECHNICAL_SWATCH,
} from './KnowledgeGraph3D.constants';
import { avatarCanvas, colorFor, iconCanvas } from './nodeCanvas';
import { NodeType } from './types';

const TYPE_LABEL_KEY: Record<NodeType, string> = {
  domain: 'label.domain',
  product: 'label.data-product',
  table: 'label.table',
  column: 'label.column',
  database: 'label.database',
  schema: 'label.schema',
  service: 'label.service',
  dashboard: 'label.dashboard',
  pipeline: 'label.pipeline',
  user: 'label.user',
  team: 'label.team',
  concept: 'label.business-concept',
  tag: 'label.tag',
  query: 'label.query',
  topic: 'label.topic',
  container: 'label.container',
  mlmodel: 'label.ml-model',
  searchIndex: 'label.search-index',
  storedProcedure: 'label.stored-procedure',
  testCase: 'label.test-case',
  testSuite: 'label.test-suite',
  dataContract: 'label.data-contract',
  api: 'label.api-endpoint',
  metric: 'label.metric',
  chart: 'label.chart',
  file: 'label.file',
  directory: 'label.directory',
};

const safeDataUrl = (canvas: HTMLCanvasElement): string => {
  let url = '';
  try {
    url = canvas.toDataURL();
  } catch {
    url = '';
  }

  return url;
};

const legendIconFor = (type: NodeType): { url: string; rounded: boolean } => {
  let result: { url: string; rounded: boolean };
  if (type === 'user') {
    result = {
      url: safeDataUrl(avatarCanvas('Hima R.', false)),
      rounded: true,
    };
  } else if (type === 'team') {
    result = {
      url: safeDataUrl(avatarCanvas('Growth Data', true)),
      rounded: true,
    };
  } else {
    result = {
      url: safeDataUrl(iconCanvas(type, colorFor(type))),
      rounded: false,
    };
  }

  return result;
};

const KnowledgeGraph3DLegend: FC = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const items = useMemo(
    () =>
      LEGEND_TYPES.map((type) => ({
        type,
        label: t(TYPE_LABEL_KEY[type]),
        ...legendIconFor(type),
      })),
    [t]
  );

  return (
    <div className="kg3d-legend tw:absolute tw:bottom-4 tw:left-4 tw:overflow-hidden tw:rounded-xl tw:border tw:border-white/10 tw:text-white">
      <button
        className="tw:flex tw:w-full tw:items-center tw:gap-2.5 tw:px-3.5 tw:py-2.5"
        type="button"
        onClick={() => setIsOpen((open) => !open)}>
        <span className="tw:inline-flex tw:items-center tw:gap-1">
          <i
            className="tw:size-2 tw:rounded-full"
            style={{ background: colorFor('table') }}
          />
          <i
            className="tw:size-2 tw:rounded-full"
            style={{ background: colorFor('product') }}
          />
          <i
            className="tw:size-2 tw:rounded-full"
            style={{ background: colorFor('concept') }}
          />
        </span>
        <span className="tw:text-xs tw:font-semibold tw:tracking-wide tw:uppercase tw:opacity-70">
          {t('label.legend')}
        </span>
        <span
          className="tw:ml-auto tw:text-xs tw:opacity-60 tw:transition-transform"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}>
          ▸
        </span>
      </button>

      {isOpen && (
        <div className="tw:px-3.5 tw:pb-3.5">
          <div className="tw:mb-2.5 tw:text-xs tw:font-semibold tw:tracking-wide tw:uppercase tw:opacity-60">
            {t('label.entity-plural')}
          </div>
          <div className="tw:grid tw:grid-cols-2 tw:gap-x-4.5 tw:gap-y-1.5 tw:text-xs">
            {items.map((item) => (
              <span
                className="tw:flex tw:items-center tw:gap-1.5"
                key={item.type}>
                <img
                  alt=""
                  src={item.url}
                  style={{
                    width: 17,
                    height: 17,
                    borderRadius: item.rounded ? '50%' : 5,
                  }}
                />
                {item.label}
              </span>
            ))}
          </div>
          <div className="tw:my-2.5 tw:h-px tw:bg-white/10" />
          <div className="tw:mb-2 tw:text-xs tw:font-semibold tw:tracking-wide tw:uppercase tw:opacity-60">
            {t('label.relationship-plural')}
          </div>
          <div className="tw:flex tw:gap-4 tw:text-xs">
            <span className="tw:flex tw:items-center tw:gap-1.5">
              <i
                className="tw:inline-block tw:h-0.5 tw:w-4 tw:rounded-sm"
                style={{ background: LINK_TECHNICAL_SWATCH }}
              />
              {t('label.knowledge-graph')}
            </span>
            <span className="tw:flex tw:items-center tw:gap-1.5">
              <i
                className="tw:inline-block tw:h-0.5 tw:w-4 tw:rounded-sm"
                style={{ background: LINK_ONTOLOGY_COLOR }}
              />
              {t('label.ontology')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraph3DLegend;
