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
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyPublicationStatus } from '../../../../generated/type/ontologyPublicationStatus';
import { useOntologyDraftGuard } from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import { useOntologyStudioModel } from '../../../../hooks/governance/ontology/useOntologyStudioModel';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getOntologyHealthSummary } from '../../../OntologyExplorer/OntologyStudio.utils';
import OntologyMemoryReviewPanel from '../../../OntologyExplorer/OntologyMemoryReviewPanel';
import { FILTERS } from '../AllOntologiesGraphView/AllOntologiesGraphView.constants';
import OntologyAuthoringWorkspace from '../OntologyAuthoringWorkspace/OntologyAuthoringWorkspace';
import OntologyAxiomWorkspace from '../OntologyAxiomWorkspace/OntologyAxiomWorkspace';
import { AxiomStatus } from '../OntologyAxiomWorkspace/OntologyAxiomWorkspace.utils';
import OntologyCreateForm from '../OntologyCreateForm/OntologyCreateForm';
import OntologyGraphView, {
  OntologyModelStats,
} from '../OntologyGraphView/OntologyGraphView';
import OntologyOverview from '../OntologyOverview/OntologyOverview';

interface OntologyStudioWorkspaceProps {
  ontology: Ontology;
  /** Set when reading the published release, which freezes the definitions and hides editing. */
  releaseId?: string;
  publicationStatus?: OntologyPublicationStatus;
  createConceptRequestKey?: number;
  onCreateConceptRequestHandled?: () => void;
  onRequestCreateConcept?: () => void;
  onAuthoringLockChange?: (locked: boolean) => void;
  initialDraftId?: string;
  mode: 'view' | 'edit' | 'definitions' | 'review';
  viewSurface: 'graph' | 'tree' | 'ontology';
  selectedConceptId?: string;
  onSelectedConceptChange?: (id?: string) => void;
  onSaved: (ontology: Ontology) => void;
  onRequestEdit?: (conceptId?: string) => void;
  /** View mode's Add on an ontology tab: switches to Edit's Ontology surface; false when refused. */
  onRequestDefinitionsEdit?: () => boolean;
  /** View mode's "Show on graph": View's graph with the concept selected. */
  onShowConceptOnGraph?: (conceptId: string) => void;
  onOpenPublication?: () => void;
  editConceptRequest?: string;
  onEditConceptRequestHandled?: () => void;
  onRequestGraphSurface: () => void;
  onRequestTreeSurface?: () => void;
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

  // The canvas toolbar floats over the bottom edge, so the last row scrolls clear of it.
  return isAiMode
    ? 'tw:min-h-0 tw:flex-1 tw:overflow-auto tw:px-8 tw:pt-6 tw:pb-24'
    : 'tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-6';
};

/** View mode's Ontology surface shows the tabs read-only, over the draft or a published release. */
const showsReadOnlyTabs = (
  mode: OntologyStudioWorkspaceProps['mode'],
  viewSurface: OntologyStudioWorkspaceProps['viewSurface']
) => mode === 'view' && viewSurface === 'ontology';

type DefinitionTab = 'concept' | 'property' | 'axiom';

const OntologyStudioWorkspace = ({
  ontology,
  releaseId,
  publicationStatus,
  createConceptRequestKey,
  onCreateConceptRequestHandled,
  onRequestCreateConcept,
  onAuthoringLockChange,
  initialDraftId,
  mode,
  viewSurface,
  selectedConceptId,
  onSelectedConceptChange,
  onSaved,
  onRequestEdit,
  onRequestDefinitionsEdit,
  onShowConceptOnGraph,
  onOpenPublication,
  editConceptRequest,
  onEditConceptRequestHandled,
  onRequestGraphSurface,
  onRequestTreeSurface,
  onStatsChange,
  onWorkingChange,
}: OntologyStudioWorkspaceProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const guard = useOntologyDraftGuard();
  const [definitionTab, setDefinitionTab] = useState<string | number>(
    'overview'
  );
  // Set only by the Overview's Review conflicts, so a plain visit opens Constraints unfiltered.
  const [axiomStatus, setAxiomStatus] = useState<AxiomStatus>();
  const [revision, setRevision] = useState(0);
  // The tab whose Add was pressed in View mode; Edit opens that tab's create form.
  const [createFor, setCreateFor] = useState<DefinitionTab>();
  // A published release is frozen, so its tabs offer no Add.
  const createProps = (tab: DefinitionTab, isReadOnly: boolean) => ({
    shouldOpenCreate: !isReadOnly && createFor === tab,
    onCreateOpened: () => setCreateFor(undefined),
    onRequestCreate:
      isReadOnly && !releaseId && onRequestDefinitionsEdit
        ? () => {
            if (onRequestDefinitionsEdit()) {
              setCreateFor(tab);
            }
          }
        : undefined,
  });
  // Edit can still bounce back to View (no edit rights); the intent must not outlive it.
  useEffect(() => {
    if (mode === 'view') {
      setCreateFor(undefined);
    }
  }, [mode]);
  const isReadOnlyTabs = showsReadOnlyTabs(mode, viewSurface);
  const tabsReleaseId = isReadOnlyTabs ? releaseId : undefined;
  const { model, graph, relations } = useOntologyStudioModel(
    mode === 'definitions' || isReadOnlyTabs ? ontology : undefined,
    tabsReleaseId
  );
  // The header counts what the tabs show; without this it keeps the last graph's counts.
  useEffect(() => {
    if (model) {
      onStatsChange?.({
        conceptCount: model.concepts.length,
        isolatedCount: getOntologyHealthSummary(graph, FILTERS).isolatedTerms
          .length,
        ontologyId: ontology.id,
        relationCount: relations.length,
      });
    }
  }, [graph, model, onStatsChange, ontology.id, relations.length]);
  // Leaving for the graph drops an open definition editor, so it asks first.
  const openConcept = onRequestEdit
    ? (conceptId: string) => guard(() => onRequestEdit(conceptId))
    : undefined;
  const { canEditAll } = useEntityPermissions(
    ResourceEntity.ONTOLOGY,
    { id: ontology.id },
    { deleted: ontology.deleted }
  );

  const header = (
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
          data-testid="ontology-studio-description"
          ellipsis={{ rows: 2 }}
          size="text-sm">
          {ontology.description}
        </Typography>
      ) : null}
    </Box>
  );

  // The ontology's tabs; View mode shows them read-only, Edit's definitions can change them.
  const renderDefinitionTabs = (isReadOnly: boolean) => (
    <Tabs
      className="tw:gap-5"
      selectedKey={definitionTab}
      onSelectionChange={(key) =>
        guard(() => {
          setAxiomStatus(undefined);
          setDefinitionTab(key);
        })
      }>
      {header}
      <Tabs.List aria-label={t('label.definition')} type="underline">
        <Tabs.Item id="overview">{t('label.overview')}</Tabs.Item>
        <Tabs.Item
          aria-label={t('label.concept-plural')}
          badge={model?.concepts.length}
          id="concept">
          {t('label.concept-plural')}
        </Tabs.Item>
        <Tabs.Item
          aria-label={t('label.property-plural')}
          badge={model?.properties.length}
          id="property">
          {t('label.property-plural')}
        </Tabs.Item>
        <Tabs.Item
          aria-label={t('label.constraint-plural')}
          badge={model?.axioms.length}
          id="axiom">
          {t('label.constraint-plural')}
        </Tabs.Item>
        <Tabs.Item id="settings">{t('label.setting-plural')}</Tabs.Item>
      </Tabs.List>
      <Tabs.Panel id="overview">
        <OntologyOverview
          ontology={ontology}
          releaseId={tabsReleaseId}
          status={publicationStatus}
          onOpenPublication={isReadOnly ? undefined : onOpenPublication}
          onOpenTab={(tab, status) =>
            guard(() => {
              setAxiomStatus(status);
              setDefinitionTab(tab);
            })
          }
        />
      </Tabs.Panel>
      <Tabs.Panel id="concept">
        <OntologyAuthoringWorkspace
          {...createProps('concept', isReadOnly)}
          isReadOnly={isReadOnly}
          ontology={ontology}
          releaseId={tabsReleaseId}
          // View mode opens the concept read-only here, as properties do.
          onOpenConcept={isReadOnly ? undefined : openConcept}
          onWorkingChange={onWorkingChange}
        />
      </Tabs.Panel>
      <Tabs.Panel id="property">
        <OntologyAuthoringWorkspace
          {...createProps('property', isReadOnly)}
          definitionType="property"
          isReadOnly={isReadOnly}
          ontology={ontology}
          releaseId={tabsReleaseId}
          onWorkingChange={onWorkingChange}
        />
      </Tabs.Panel>
      <Tabs.Panel id="axiom">
        <OntologyAxiomWorkspace
          {...createProps('axiom', isReadOnly)}
          initialStatus={axiomStatus}
          isReadOnly={isReadOnly}
          ontology={ontology}
          releaseId={tabsReleaseId}
          onOpenConcept={isReadOnly ? onShowConceptOnGraph : openConcept}
          onWorkingChange={onWorkingChange}
        />
      </Tabs.Panel>
      <Tabs.Panel id="settings">
        <OntologyCreateForm
          canEdit={canEditAll && !isReadOnly}
          ontology={ontology}
          onSaved={(saved) => {
            onSaved(saved);
            onWorkingChange?.();
          }}
        />
      </Tabs.Panel>
    </Tabs>
  );

  const renderContent = () => {
    switch (mode) {
      case 'definitions':
        return renderDefinitionTabs(false);
      case 'view':
      case 'edit':
        if (viewSurface === 'ontology') {
          return (
            <Box
              className={
                isAiMode
                  ? 'tw:h-full tw:overflow-auto tw:px-8 tw:pt-6 tw:pb-24'
                  : 'tw:h-full tw:overflow-auto tw:p-6'
              }
              direction="col">
              {renderDefinitionTabs(true)}
            </Box>
          );
        }

        return (
          <OntologyGraphView
            createConceptRequestKey={createConceptRequestKey}
            editConceptRequest={editConceptRequest}
            isEditing={mode === 'edit'}
            key={revision}
            ontology={ontology}
            releaseId={releaseId}
            selectedConceptId={selectedConceptId}
            surface={viewSurface}
            onAuthoringLockChange={onAuthoringLockChange}
            onCreateConceptRequestHandled={onCreateConceptRequestHandled}
            onEditConceptRequestHandled={onEditConceptRequestHandled}
            onRequestCreateConcept={onRequestCreateConcept}
            onRequestEdit={onRequestEdit}
            onRequestGraphSurface={onRequestGraphSurface}
            onRequestTreeSurface={onRequestTreeSurface}
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
