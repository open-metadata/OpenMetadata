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

import { Alert } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Glossary } from '../../generated/entity/data/glossary';
import OntologyAxiomPanel from './OntologyAxiomPanel';
import { OntologyGraphData } from './OntologyExplorer.interface';
import OntologyIriPreviewPanel from './OntologyIriPreviewPanel';
import OntologyPatternPanel from './OntologyPatternPanel';
import OntologyStructurePanel from './OntologyStructurePanel';
import OntologySubsetPanel from './OntologySubsetPanel';

interface OntologyModelingWorkbenchProps {
  glossaries: Glossary[];
  graphData?: OntologyGraphData | null;
  selectedGlossary?: Glossary;
}

type ModelingSurface = 'axioms' | 'iri' | 'merge' | 'patterns' | 'subset';

interface ModelingSurfaceProps extends OntologyModelingWorkbenchProps {
  selectedGlossary: Glossary;
  surface: ModelingSurface;
}

const renderModelingSurface = ({
  glossaries,
  graphData,
  selectedGlossary,
  surface,
}: ModelingSurfaceProps): ReactNode => {
  let content: ReactNode;

  switch (surface) {
    case 'patterns':
      content = <OntologyPatternPanel glossary={selectedGlossary} />;

      break;
    case 'subset':
      content = (
        <OntologySubsetPanel
          glossaries={glossaries}
          graphData={graphData}
          selectedGlossary={selectedGlossary}
        />
      );

      break;
    case 'merge':
      content = (
        <OntologyStructurePanel
          glossaries={glossaries}
          graphData={graphData}
          selectedGlossary={selectedGlossary}
        />
      );

      break;
    case 'axioms':
      content = <OntologyAxiomPanel glossary={selectedGlossary} />;

      break;
    case 'iri':
    default:
      content = <OntologyIriPreviewPanel glossary={selectedGlossary} />;

      break;
  }

  return content;
};

const OntologyModelingWorkbench = ({
  glossaries,
  graphData,
  selectedGlossary,
}: OntologyModelingWorkbenchProps) => {
  const { t } = useTranslation();
  const [surface, setSurface] = useState<ModelingSurface>('iri');
  const tabs = [
    { id: 'iri' as const, label: t('label.concept-iri') },
    { id: 'patterns' as const, label: t('label.template') },
    { id: 'subset' as const, label: t('label.include') },
    { id: 'merge' as const, label: t('label.merge') },
    {
      id: 'axioms' as const,
      label: `${t('label.ontology')} ${t('label.constraint-plural')}`,
    },
  ];
  const content = !selectedGlossary ? (
    <div className="tw:w-full tw:p-6">
      <Alert
        title={t('label.select-entity', { entity: t('label.glossary') })}
        variant="gray"
      />
    </div>
  ) : (
    <div
      className="tw:h-full tw:w-full tw:overflow-auto tw:bg-secondary tw:p-6"
      data-testid="ontology-modeling-workbench">
      <div className="tw:mx-auto tw:flex tw:max-w-5xl tw:flex-col tw:gap-5">
        <nav
          aria-label={t('label.model')}
          className="tw:flex tw:flex-wrap tw:gap-2">
          {tabs.map((tab) => (
            <button
              aria-pressed={surface === tab.id}
              className={classNames(
                'tw:rounded-lg tw:border tw:px-3 tw:py-2 tw:text-sm tw:font-semibold',
                'tw:focus-visible:outline-2 tw:focus-visible:outline-offset-1 tw:focus-visible:outline-brand-600',
                surface === tab.id
                  ? 'tw:border-brand tw:bg-brand-primary tw:text-brand-secondary'
                  : 'tw:border-secondary tw:bg-primary tw:text-secondary'
              )}
              data-testid={`ontology-modeling-tab-${tab.id}`}
              key={tab.id}
              type="button"
              onClick={() => setSurface(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>
        {renderModelingSurface({
          glossaries,
          graphData,
          selectedGlossary,
          surface,
        })}
      </div>
    </div>
  );

  return content;
};

export default OntologyModelingWorkbench;
