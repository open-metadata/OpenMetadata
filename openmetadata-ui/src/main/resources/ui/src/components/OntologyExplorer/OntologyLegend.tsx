/*
 *  Copyright 2024 Collate.
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

import { ChevronDown, ChevronUp } from '@untitledui/icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RELATION_META } from './OntologyExplorer.constants';
import { OntologyEdge } from './OntologyExplorer.interface';

export interface OntologyLegendProps {
  edges: OntologyEdge[];
}

const OntologyLegend: React.FC<OntologyLegendProps> = ({ edges }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  const activeRelationTypes = useMemo(() => {
    const types = new Set<string>();
    edges.forEach((edge) => {
      if (edge.relationType) {
        types.add(edge.relationType);
      }
    });

    return Array.from(types).sort();
  }, [edges]);

  if (activeRelationTypes.length === 0) {
    return null;
  }

  return (
    <div className="ontology-legend">
      <button
        className="ontology-legend__header"
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}>
        <span className="ontology-legend__title">
          {t('label.relation-type-plural')}
        </span>
        {isExpanded ? (
          <ChevronDown className="ontology-legend__icon" size={12} />
        ) : (
          <ChevronUp className="ontology-legend__icon" size={12} />
        )}
      </button>

      {isExpanded && (
        <div className="ontology-legend__content">
          {activeRelationTypes.map((relationType) => {
            const meta = RELATION_META[relationType] ?? RELATION_META.related;
            const displayName = meta ? t(meta.labelKey) : relationType;

            return (
              <div className="ontology-legend__item" key={relationType}>
                <div
                  className="ontology-legend__line"
                  style={{ backgroundColor: meta?.color }}
                />
                <span className="ontology-legend__label">{displayName}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OntologyLegend;
