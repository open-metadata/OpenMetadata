/*
 *  Copyright 2025 Collate.
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

import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import {
  BAND_LABEL_FONT_SIZE,
  BAND_LABEL_INSET,
  BAND_RADIUS,
} from './KnowledgeGraph.constants';
import {
  GraphLevelRing,
  KnowledgeGraphLayout,
} from './KnowledgeGraph.interface';

const KnowledgeGraphBands = ({
  rings,
  layout,
  showBands,
  zoom,
}: {
  rings: GraphLevelRing[];
  layout: KnowledgeGraphLayout;
  showBands: boolean;
  zoom: number;
}) => {
  const { t } = useTranslation();

  return (
    <svg
      aria-hidden="true"
      className="kg-level-rings"
      data-testid="graph-level-rings">
      {showBands &&
        rings.map((ring) => {
          const variant = ring.level === 2 ? 'direct' : 'extended';

          return (
            <g data-testid={'graph-ring-' + ring.level} key={ring.level}>
              {layout === 'lanes' ? (
                <>
                  <rect
                    className={classNames('kg-band', 'kg-band-' + variant)}
                    height={ring.radiusY * 2}
                    rx={BAND_RADIUS * zoom}
                    strokeDasharray="6 7"
                    width={ring.radiusX * 2}
                    x={ring.x - ring.radiusX}
                    y={ring.y - ring.radiusY}
                  />
                  <text
                    className={classNames(
                      'kg-band-label',
                      'kg-band-label-' + variant
                    )}
                    fontSize={BAND_LABEL_FONT_SIZE * zoom}
                    x={ring.x - ring.radiusX + BAND_LABEL_INSET.x * zoom}
                    y={ring.y - ring.radiusY + BAND_LABEL_INSET.y * zoom}>
                    {t('label.kg-band', {
                      level: ring.level,
                      name: t(
                        ring.level === 2 ? 'label.direct' : 'label.extended'
                      ),
                    })}
                  </text>
                </>
              ) : (
                <ellipse
                  cx={ring.x}
                  cy={ring.y}
                  fill="none"
                  rx={ring.radiusX}
                  ry={ring.radiusY}
                  stroke="var(--om-color-border-secondary)"
                  strokeDasharray="4 6"
                />
              )}
            </g>
          );
        })}
    </svg>
  );
};

export default KnowledgeGraphBands;
