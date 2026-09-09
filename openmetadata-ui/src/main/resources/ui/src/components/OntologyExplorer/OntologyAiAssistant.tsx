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

import { Alert, Tabs, Typography } from '@openmetadata/ui-core-components';
import { Stars02 } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { Glossary } from '../../generated/entity/data/glossary';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import OntologyAiDomainPanel from './OntologyAiDomainPanel';
import OntologyAiMappingPanel from './OntologyAiMappingPanel';
import OntologyAiQueryPanel from './OntologyAiQueryPanel';
import OntologyAiRelationshipPanel from './OntologyAiRelationshipPanel';
import { OntologyGraphData } from './OntologyExplorer.interface';

interface OntologyAiAssistantProps {
  canCreateDraft: boolean;
  glossary?: Glossary;
  graphData: OntologyGraphData | null;
  relationshipTypes: RelationshipType[];
  onOpenQuery: (query: string) => void;
}

const OntologyAiAssistant = ({
  canCreateDraft,
  glossary,
  graphData,
  relationshipTypes,
  onOpenQuery,
}: OntologyAiAssistantProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="tw:h-full tw:min-w-0 tw:flex-1 tw:overflow-auto tw:bg-secondary tw:p-6"
      data-testid="ontology-ai-assistant">
      <div className="tw:mx-auto tw:flex tw:max-w-screen-2xl tw:flex-col tw:gap-6">
        <div className="tw:flex tw:items-start tw:gap-4">
          <div className="tw:grid tw:size-11 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:bg-brand-solid tw:text-fg-white">
            <Stars02 aria-hidden="true" className="tw:size-6" />
          </div>
          <div>
            <Typography as="h1" size="display-xs" weight="semibold">
              {t('label.ontology-ai-assistant')}
            </Typography>
            <Typography
              as="p"
              className="tw:mt-1 tw:text-tertiary"
              size="text-sm">
              {t('message.ontology-ai-description')}
            </Typography>
          </div>
        </div>

        {glossary ? (
          <Tabs defaultSelectedKey="relationships">
            <Tabs.List fullWidth type="button-border">
              <Tabs.Item
                id="relationships"
                label={t('label.relationship-plural')}
              />
              <Tabs.Item id="mappings" label={t('label.mapping-plural')} />
              <Tabs.Item id="query" label={t('label.query')} />
              {canCreateDraft ? (
                <Tabs.Item id="domain" label={t('label.domain-draft')} />
              ) : null}
            </Tabs.List>
            <Tabs.Panel className="tw:pt-6" id="relationships">
              <OntologyAiRelationshipPanel
                canCreateDraft={canCreateDraft}
                glossary={glossary}
                graphData={graphData}
                relationshipTypes={relationshipTypes}
              />
            </Tabs.Panel>
            <Tabs.Panel className="tw:pt-6" id="mappings">
              <OntologyAiMappingPanel
                canCreateDraft={canCreateDraft}
                glossary={glossary}
                graphData={graphData}
              />
            </Tabs.Panel>
            <Tabs.Panel className="tw:pt-6" id="query">
              <OntologyAiQueryPanel
                glossary={glossary}
                onOpenQuery={onOpenQuery}
              />
            </Tabs.Panel>
            {canCreateDraft ? (
              <Tabs.Panel className="tw:pt-6" id="domain">
                <OntologyAiDomainPanel glossary={glossary} />
              </Tabs.Panel>
            ) : null}
          </Tabs>
        ) : (
          <Alert
            title={t('message.ontology-ai-select-glossary')}
            variant="warning"
          />
        )}
      </div>
    </div>
  );
};

export default OntologyAiAssistant;
