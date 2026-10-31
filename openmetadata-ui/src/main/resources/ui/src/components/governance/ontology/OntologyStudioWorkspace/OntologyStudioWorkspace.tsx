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
import { Box, Tabs, Typography } from '@openmetadata/ui-core-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useOntologyDraftGuard } from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyMemoryReviewPanel from '../../../OntologyExplorer/OntologyMemoryReviewPanel';
import OntologyAuthoringWorkspace from '../OntologyAuthoringWorkspace/OntologyAuthoringWorkspace';
import OntologyAxiomWorkspace from '../OntologyAxiomWorkspace/OntologyAxiomWorkspace';
import OntologyCreateForm from '../OntologyCreateForm/OntologyCreateForm';
import OntologyGraphView, {
  OntologyModelStats,
} from '../OntologyGraphView/OntologyGraphView';

interface OntologyStudioWorkspaceProps {
  ontology: Ontology;
  createConceptRequestKey?: number;
  onRequestCreateConcept?: () => void;
  onAuthoringLockChange?: (locked: boolean) => void;
  initialDraftId?: string;
  mode: 'view' | 'edit' | 'definitions' | 'review';
  viewSurface: 'graph' | 'tree';
  selectedConceptId?: string;
  onSelectedConceptChange?: (id?: string) => void;
  onSaved: (ontology: Ontology) => void;
  onRequestEdit?: () => void;
  onRequestGraphSurface: () => void;
  onStatsChange?: (stats: OntologyModelStats) => void;
  onWorkingChange?: () => void;
}

const getWorkspaceClassName = (
  mode: OntologyStudioWorkspaceProps['mode'],
  isAiMode: boolean
) => {
  if (mode === 'view' || mode === 'edit') {
    return 'tw:min-h-0 tw:flex-1 tw:overflow-hidden';
  }

  return isAiMode
    ? 'tw:min-h-0 tw:flex-1 tw:overflow-auto tw:px-8 tw:pt-6 tw:pb-10'
    : 'tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-6';
};

const OntologyStudioWorkspace = ({
  ontology,
  createConceptRequestKey,
  onRequestCreateConcept,
  onAuthoringLockChange,
  initialDraftId,
  mode,
  viewSurface,
  selectedConceptId,
  onSelectedConceptChange,
  onSaved,
  onRequestEdit,
  onRequestGraphSurface,
  onStatsChange,
  onWorkingChange,
}: OntologyStudioWorkspaceProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const guard = useOntologyDraftGuard();
  const [definitionTab, setDefinitionTab] = useState<string | number>(
    'concept'
  );
  const [revision, setRevision] = useState(0);
  const { canEditAll } = useEntityPermissions(
    ResourceEntity.ONTOLOGY,
    { id: ontology.id },
    { deleted: ontology.deleted }
  );

  const renderContent = () => {
    switch (mode) {
      case 'definitions':
        return (
          <Tabs
            className={isAiMode ? 'tw:gap-5' : undefined}
            selectedKey={definitionTab}
            onSelectionChange={(key) => guard(() => setDefinitionTab(key))}>
            {isAiMode ? (
              <Box direction="col" gap={1}>
                <Typography
                  as="h2"
                  className="not-prose tw:m-0"
                  size="text-lg"
                  weight="semibold">
                  {getEntityName(ontology)}
                </Typography>
                {ontology.description ? (
                  <Typography
                    color="secondary"
                    ellipsis={{ rows: 2 }}
                    size="text-sm">
                    {ontology.description}
                  </Typography>
                ) : null}
              </Box>
            ) : null}
            <Tabs.List aria-label={t('label.definition')} type="underline">
              <Tabs.Item id="concept">{t('label.concept-plural')}</Tabs.Item>
              <Tabs.Item id="property">{t('label.property-plural')}</Tabs.Item>
              <Tabs.Item id="axiom">{t('label.constraint-plural')}</Tabs.Item>
              <Tabs.Item id="settings">{t('label.setting-plural')}</Tabs.Item>
            </Tabs.List>
            <Tabs.Panel id="concept">
              <OntologyAuthoringWorkspace
                ontology={ontology}
                onWorkingChange={onWorkingChange}
              />
            </Tabs.Panel>
            <Tabs.Panel id="property">
              <OntologyAuthoringWorkspace
                definitionType="property"
                ontology={ontology}
                onWorkingChange={onWorkingChange}
              />
            </Tabs.Panel>
            <Tabs.Panel id="axiom">
              <OntologyAxiomWorkspace
                ontology={ontology}
                onWorkingChange={onWorkingChange}
              />
            </Tabs.Panel>
            <Tabs.Panel id="settings">
              <OntologyCreateForm
                canEdit={canEditAll}
                ontology={ontology}
                onSaved={(saved) => {
                  onSaved(saved);
                  onWorkingChange?.();
                }}
              />
            </Tabs.Panel>
          </Tabs>
        );
      case 'view':
      case 'edit':
        return (
          <OntologyGraphView
            createConceptRequestKey={createConceptRequestKey}
            isEditing={mode === 'edit'}
            key={revision}
            ontology={ontology}
            selectedConceptId={selectedConceptId}
            surface={viewSurface}
            onAuthoringLockChange={onAuthoringLockChange}
            onRequestCreateConcept={onRequestCreateConcept}
            onRequestEdit={onRequestEdit}
            onRequestGraphSurface={onRequestGraphSurface}
            onSelectedConceptChange={onSelectedConceptChange}
            onStatsChange={onStatsChange}
            onWorkingChange={onWorkingChange}
          />
        );
      case 'review':
        return (
          <OntologyMemoryReviewPanel
            canApply={canEditAll}
            canDiscard={canEditAll}
            canSubmit={canEditAll}
            initialDraftId={initialDraftId}
            ontologyId={ontology.id}
            onApplied={() => {
              setRevision((value) => value + 1);
              onWorkingChange?.();
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box
      className={getWorkspaceClassName(mode, isAiMode)}
      direction="col"
      gap={4}>
      {renderContent()}
    </Box>
  );
};

export default OntologyStudioWorkspace;
