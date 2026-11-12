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

import {
  BadgeWithDot,
  Box,
  Button,
  Divider,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowRight,
  Expand05,
  GitBranch01,
  Grid01,
  Minimize02,
  Plus,
  Share07,
} from '@openmetadata/ui-core-components/icons';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import NoDataPlaceholder from '../../components/common/EmptyPlaceholder/NoDataPlaceholder';
import SomethingWentWrongPlaceholder from '../../components/common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import HeaderBreadcrumb from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import { getGlossaryHomeCrumb } from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.utils';
import Loader from '../../components/common/Loader/Loader';
import AggregateConceptInspector from '../../components/governance/ontology/AllOntologiesGraphView/AggregateConceptInspector';
import AllOntologiesGraphView from '../../components/governance/ontology/AllOntologiesGraphView/AllOntologiesGraphView';
import { FILTERS as NATIVE_FILTERS } from '../../components/governance/ontology/AllOntologiesGraphView/AllOntologiesGraphView.constants';
import OntologyAllOntologiesConceptDrawer from '../../components/governance/ontology/OntologyAuthoringWorkspace/OntologyAllOntologiesConceptDrawer';
import OntologyCreateDialog from '../../components/governance/ontology/OntologyCreateDialog/OntologyCreateDialog';
import OntologyEmptyState from '../../components/governance/ontology/OntologyEmptyState/OntologyEmptyState';
import { OntologyGraphSearchSlotContext } from '../../components/governance/ontology/OntologyGraphView/OntologyGraphSearchSlot.context';
import { OntologyModelStats } from '../../components/governance/ontology/OntologyGraphView/OntologyGraphView';
import OntologyNativeImportDialog from '../../components/governance/ontology/OntologyNativeImportDialog/OntologyNativeImportDialog';
import OntologyPublicationModal from '../../components/governance/ontology/OntologyPublicationModal/OntologyPublicationModal';
import OntologyQueryPicker from '../../components/governance/ontology/OntologyQueryPicker/OntologyQueryPicker';
import OntologySettingsDialog from '../../components/governance/ontology/OntologySettingsDialog/OntologySettingsDialog';
import { OntologyStudioDrawerHostContext } from '../../components/governance/ontology/OntologyStudioDrawer/OntologyStudioDrawer.context';
import OntologyStudioHeader from '../../components/governance/ontology/OntologyStudioHeader/OntologyStudioHeader';
import OntologyStudioScopeMenu from '../../components/governance/ontology/OntologyStudioScopeMenu/OntologyStudioScopeMenu';
import OntologyStudioSubBar from '../../components/governance/ontology/OntologyStudioSubBar/OntologyStudioSubBar';
import OntologyStudioWorkspace from '../../components/governance/ontology/OntologyStudioWorkspace/OntologyStudioWorkspace';
import OntologyTasksDrawer from '../../components/governance/ontology/OntologyTasksDrawer/OntologyTasksDrawer';
import OntologyVersionChip from '../../components/governance/ontology/OntologyVersionChip/OntologyVersionChip';
import { useOntologyAiCapability } from '../../components/OntologyExplorer/hooks/useOntologyAiCapability';
import OntologyAiAssistant from '../../components/OntologyExplorer/OntologyAiAssistant';
import OntologyEditLeaseStatus from '../../components/OntologyExplorer/OntologyEditLeaseStatus';
import OntologyExplorer from '../../components/OntologyExplorer/OntologyExplorer';
import { OntologyGraphData } from '../../components/OntologyExplorer/OntologyExplorer.interface';
import OntologyImportExportMenu from '../../components/OntologyExplorer/OntologyImportExportMenu';
import OntologyLibrary from '../../components/OntologyExplorer/OntologyLibrary';
import OntologyMemoryReviewPanel from '../../components/OntologyExplorer/OntologyMemoryReviewPanel';
import { ONTOLOGY_STUDIO_STYLE } from '../../components/OntologyExplorer/OntologyStudio.styles';
import { getOntologyHealthSummary } from '../../components/OntologyExplorer/OntologyStudio.utils';
import OntologyStudioQueryConsole from '../../components/OntologyExplorer/OntologyStudioQueryConsole';
import OntologyVisualQueryBuilder from '../../components/OntologyExplorer/OntologyVisualQueryBuilder';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { FULLSCREEN_QUERY_PARAM_KEY } from '../../constants/constants';
import OntologyDraftProvider from '../../context/OntologyDraft/OntologyDraftProvider';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { UIPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { ResourceEntity } from '../../enums/permissions.enum';
import { Glossary } from '../../generated/entity/data/glossary';
import { Ontology } from '../../generated/entity/data/ontology';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { Operation } from '../../generated/entity/policies/policy';
import { OntologyPublicationStatus } from '../../generated/type/ontologyPublicationStatus';
import { useAuth } from '../../hooks/authHooks';
import { useOntologyDraftGuard } from '../../hooks/governance/ontology/useOntologyDraftGuard';
import {
  OntologyEditLeaseState,
  useOntologyEditLease,
} from '../../hooks/governance/ontology/useOntologyEditLease';
import { ONTOLOGY_WORKING_DIFF_QUERY_KEY } from '../../hooks/governance/ontology/useOntologyPublication';
import {
  ONTOLOGY_STUDIO_MODEL_QUERY_KEY,
  useAllOntologyStudioModels,
} from '../../hooks/governance/ontology/useOntologyStudioModel';
import {
  ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY,
  useOntologyStudioScopes,
} from '../../hooks/governance/ontology/useOntologyStudioScopes';
import { useOntologyUnpublishedCount } from '../../hooks/governance/ontology/useOntologyUnpublishedCount';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useIsAiMode } from '../../hooks/useAppMode';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
import { getOntology } from '../../rest/ontologyAPI';
import { getEntityName } from '../../utils/EntityNameUtils';
import {
  ALL_ONTOLOGIES_SCOPE,
  getScopeKey,
  getStudioScope,
  isOntologyScope,
  OntologyStudioScope,
} from '../../utils/governance/ontology/OntologyStudioScope.utils';
import {
  parseStudioUrlState,
  patchStudioUrlParams,
  StudioUrlState,
  StudioUrlVersion,
  StudioUrlView,
} from '../../utils/governance/ontology/OntologyStudioUrlState.utils';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import {
  checkPermission,
  DEFAULT_ENTITY_PERMISSION,
} from '../../utils/PermissionsUtils';
import { generateUUID } from '../../utils/StringUtils';
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from '../../utils/ToastUtils';

// 'review' has no tab; a memory's "view draft" link (?draft=) still opens it.
type StudioMode = 'view' | 'edit' | 'query' | 'ai' | 'review';
type ViewSurface = 'graph' | 'tree' | 'ontology';
type QuerySurface = 'console' | 'builder';
type EditSurface = 'graph' | 'tree' | 'definitions';

interface StudioTab {
  id: string;
  label: string;
}

interface StudioModeTab {
  id: StudioMode;
  label: string;
}

interface StudioSubMode {
  id: string;
  items: StudioTab[];
}

function getStatCount(stats: string[], label: string): string {
  const normalizedLabel = label.toLocaleLowerCase();
  const item = stats.find((stat) =>
    stat.toLocaleLowerCase().includes(normalizedLabel)
  );

  return item?.split(' ')[0] ?? '0';
}

function RdfDisabledNotice() {
  const { t } = useTranslation();

  return (
    <div
      className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:items-center tw:justify-center tw:gap-3 tw:p-8 tw:text-center"
      data-testid="ontology-rdf-disabled-notice">
      <span className="tw:grid tw:size-12 tw:place-items-center tw:rounded-full tw:bg-tertiary tw:text-quaternary">
        <Share07 aria-hidden="true" className="tw:size-6" />
      </span>
      <Typography
        as="h3"
        className="not-prose tw:m-0 tw:font-body tw:text-base tw:font-semibold tw:text-primary">
        {t('message.knowledge-graph-disabled-heading')}
      </Typography>
      <Typography
        as="p"
        className="tw:max-w-md tw:font-body tw:text-sm tw:text-tertiary">
        {t('message.knowledge-graph-disabled-description')}
      </Typography>
    </div>
  );
}

function findGlossaryById(
  glossaries: Glossary[],
  id?: string
): Glossary | undefined {
  return glossaries.find((glossary) => glossary.id === id);
}

// The glossary authoring lease, glossary change sets and AI drafts all require
// EditAll on the glossary server-side, so no narrower right can complete an
// Edit-mode action.
function computeCanEditOntology(
  isAdminUser: boolean | undefined,
  permissions: UIPermission
): boolean {
  return (
    Boolean(isAdminUser) ||
    checkPermission(Operation.EditAll, ResourceEntity.GLOSSARY, permissions)
  );
}

function computeCanCreateConcept(
  isAdminUser: boolean | undefined,
  permissions: UIPermission,
  canEditOntology: boolean
): boolean {
  return (
    canEditOntology ||
    Boolean(isAdminUser) ||
    checkPermission(Operation.Create, ResourceEntity.GLOSSARY_TERM, permissions)
  );
}

function computeChangeSetPermissions(
  isAdminUser: boolean | undefined,
  permissions: UIPermission
) {
  const canApply =
    Boolean(isAdminUser) ||
    checkPermission(Operation.EditAll, ResourceEntity.GLOSSARY, permissions);
  const canSubmit = canApply;
  const canDiscard =
    Boolean(isAdminUser) ||
    checkPermission(
      Operation.EditAll,
      ResourceEntity.ONTOLOGY_CHANGE_SET,
      permissions
    );

  return { canApply, canDiscard, canSubmit };
}

function computeModeTabs(
  t: TFunction,
  canEditOntology: boolean,
  isOntologyAiEnabled: boolean
): StudioModeTab[] {
  const editModeTabs: StudioModeTab[] = canEditOntology
    ? [{ id: 'edit', label: t('label.edit') }]
    : [];
  const aiModeTabs: StudioModeTab[] = isOntologyAiEnabled
    ? [{ id: 'ai', label: t('label.ai') }]
    : [];

  return [
    { id: 'view', label: t('label.view') },
    ...editModeTabs,
    { id: 'query', label: t('label.query') },
    ...aiModeTabs,
  ];
}

function resolveLeaseGlossary(
  conceptDraft: { defaultGlossaryId?: string; id: string } | undefined,
  authoringGlossary: Glossary | undefined,
  graphLeaseGlossary: Glossary | undefined,
  glossaries: Glossary[]
): Glossary | undefined {
  if (!conceptDraft) {
    return graphLeaseGlossary;
  }

  return (
    authoringGlossary ??
    findGlossaryById(glossaries, conceptDraft.defaultGlossaryId)
  );
}

function getEditLeaseState(
  isOwned: boolean,
  isForCurrentGlossary: boolean,
  state: OntologyEditLeaseState
): OntologyEditLeaseState | 'acquiring' {
  return isOwned && !isForCurrentGlossary ? 'acquiring' : state;
}

function getSelectedGlossaryLabel(
  selectedGlossary: Glossary | undefined,
  allGlossariesLabel: string
): string {
  return (
    selectedGlossary?.displayName ??
    selectedGlossary?.name ??
    allGlossariesLabel
  );
}

function resolveGraphLeaseGlossary(
  selectedGlossary: Glossary | undefined,
  authoringGlossary: Glossary | undefined
): Glossary | undefined {
  return selectedGlossary ?? authoringGlossary;
}

interface LeaseOwnership {
  isLeaseForCurrentGlossary: boolean;
  isLeaseOwned: boolean;
}

function getLeaseOwnership(
  editLease: ReturnType<typeof useOntologyEditLease>,
  leaseGlossary: Glossary | undefined
): LeaseOwnership {
  const isLeaseForCurrentGlossary =
    !editLease.lock || editLease.lock.resourceId === leaseGlossary?.id;

  return {
    isLeaseForCurrentGlossary,
    isLeaseOwned: editLease.isOwned && isLeaseForCurrentGlossary,
  };
}

interface StudioVisibilityFlags {
  showAiAssistant: boolean;
  showHealth: boolean;
  showQuerySurface: boolean;
  showReviewSurface: boolean;
  showRdfDisabledNotice: boolean;
}

function computeVisibilityFlags(
  mode: StudioMode,
  isOntologyAiEnabled: boolean,
  isRdfEnabled: boolean,
  isCapabilityLoading: boolean
): StudioVisibilityFlags {
  return {
    showAiAssistant: mode === 'ai' && isOntologyAiEnabled,
    showHealth: mode === 'view' || mode === 'edit',
    showQuerySurface: mode === 'query',
    showReviewSurface: mode === 'review',
    showRdfDisabledNotice:
      mode === 'query' && !isRdfEnabled && !isCapabilityLoading,
  };
}

function resolveViewSurface(
  view: StudioUrlView | undefined,
  isNativeOntology: boolean
): ViewSurface {
  if (view === 'tree') {
    return 'tree';
  }

  return view === 'ontology' && isNativeOntology ? 'ontology' : 'graph';
}

function resolveQuerySurface(view: StudioUrlView | undefined): QuerySurface {
  return view === 'builder' ? 'builder' : 'console';
}

function resolveEditSurface(
  view: StudioUrlView | undefined,
  isNativeOntology: boolean
): EditSurface {
  if (!isNativeOntology) {
    return 'graph';
  }
  if (view === 'ontology') {
    return 'definitions';
  }

  return view === 'tree' ? 'tree' : 'graph';
}

function getViewSubModeConfiguration(
  viewSurface: ViewSurface,
  isNativeOntology: boolean,
  t: TFunction
): StudioSubMode {
  return {
    id: viewSurface,
    items: [
      { id: 'graph', label: t('label.graph') },
      { id: 'tree', label: t('label.tree') },
      ...(isNativeOntology
        ? [{ id: 'ontology', label: t('label.ontology') }]
        : []),
    ],
  };
}

function getQuerySubModeConfiguration(
  querySurface: QuerySurface,
  isRdfEnabled: boolean,
  showVisualBuilder: boolean,
  t: TFunction
): StudioSubMode {
  return {
    id: querySurface,
    items: isRdfEnabled
      ? [
          { id: 'console', label: t('label.sparql-console') },
          ...(showVisualBuilder
            ? [{ id: 'builder', label: t('label.visual-builder') }]
            : []),
        ]
      : [],
  };
}

function getSubModeConfiguration(
  mode: StudioMode,
  surfaces: {
    editSurface: EditSurface;
    viewSurface: ViewSurface;
    querySurface: QuerySurface;
  },
  isRdfEnabled: boolean,
  isNativeOntology: boolean,
  hasOntologySurfaces: boolean,
  t: TFunction
): StudioSubMode {
  const configByMode: Record<StudioMode, () => StudioSubMode> = {
    ai: () => ({ id: 'ai', items: [] }),
    edit: () => ({
      id: hasOntologySurfaces ? surfaces.editSurface : 'graph',
      items: [
        { id: 'graph', label: t('label.graph') },
        ...(hasOntologySurfaces
          ? [
              { id: 'tree', label: t('label.tree') },
              { id: 'definitions', label: t('label.ontology') },
            ]
          : []),
      ],
    }),
    query: () =>
      getQuerySubModeConfiguration(
        surfaces.querySurface,
        isRdfEnabled || isNativeOntology,
        true,
        t
      ),
    review: () => ({ id: 'review', items: [] }),
    view: () =>
      getViewSubModeConfiguration(surfaces.viewSurface, hasOntologySurfaces, t),
  };

  return configByMode[mode]();
}

interface StudioReadInput {
  canEdit: boolean;
  isPermissionLoading: boolean;
  mode: StudioMode;
  isNativeOntology: boolean;
  listedStatus: OntologyPublicationStatus | undefined;
  requestedVersion: StudioUrlVersion | undefined;
  selectedOntology: Ontology | undefined;
  showEditTab: boolean;
}

/**
 * Decides which version of an open native ontology the Studio reads. Users without edit
 * rights always read the active release; editors read the draft unless they asked for the
 * release, and Edit always works on the draft.
 */
function resolveStudioRead({
  canEdit,
  isPermissionLoading,
  isNativeOntology,
  listedStatus,
  mode,
  requestedVersion,
  selectedOntology,
  showEditTab,
}: StudioReadInput) {
  const isOpen = isNativeOntology && Boolean(selectedOntology);
  const readsPublished =
    isOpen && mode !== 'edit' && (!canEdit || requestedVersion === 'published');
  const releaseStatus = listedStatus ?? selectedOntology?.publicationStatus;

  return {
    canOfferEdit: showEditTab && !readsPublished,
    isVersionPending: isOpen && isPermissionLoading,
    publishedReleaseId: readsPublished
      ? releaseStatus?.active?.releaseId
      : undefined,
    releaseStatus,
    version: (readsPublished ? 'published' : 'draft') as StudioUrlVersion,
  };
}

/**
 * Edit needs edit rights on the ontology, or on the concept the URL selects: a concept
 * owner enters Edit from that concept's panel and stays only while it is selected.
 */
const canEnterEditMode = (
  canEditScope: boolean,
  isNativeOntology: boolean,
  canEditNative: boolean,
  canEditSelectedConcept: boolean
) =>
  canEditScope &&
  (!isNativeOntology || canEditNative || canEditSelectedConcept);

function getExplorerSurface(
  mode: StudioMode,
  viewSurface: ViewSurface,
  editSurface: EditSurface,
  isNativeOntology: boolean
): ViewSurface {
  if (mode === 'view') {
    return isNativeOntology || viewSurface !== 'ontology'
      ? viewSurface
      : 'graph';
  }

  return mode === 'edit' && editSurface === 'tree' ? 'tree' : 'graph';
}

/** One ontology shows its graph canvas in View and Edit, except on the Ontology tab. */
function isNativeGraphCanvas(
  mode: StudioMode,
  explorerSurface: ViewSurface,
  editSurface: EditSurface
): boolean {
  if (mode === 'edit') {
    return explorerSurface === 'graph' && editSurface !== 'definitions';
  }

  return mode === 'view' && explorerSurface === 'graph';
}

function getShellClassName(isFullScreen: boolean) {
  return classNames(
    'tw:group/studio tw:flex tw:h-full tw:min-h-0 tw:flex-col tw:overflow-hidden tw:bg-primary tw:font-body tw:antialiased',
    // Full screen covers the app shell; dialogs (z-50) still open above it.
    isFullScreen ? 'tw:fixed tw:inset-0 tw:z-40' : 'tw:relative'
  );
}

// Graph and Tree both mount the graph view, which opens New concept (Tree switches to Graph).
function mountsGraphView(surface: string) {
  return surface === 'graph' || surface === 'tree';
}

function offersOntologySurfaces(scope: ReturnType<typeof getStudioScope>) {
  return scope.kind === 'allOntologies' || isOntologyScope(scope);
}

function getAggregateSurface(
  mode: StudioMode,
  viewSurface: ViewSurface,
  editSurface: EditSurface
): ViewSurface {
  if (mode === 'edit') {
    return editSurface === 'definitions' ? 'ontology' : editSurface;
  }

  return viewSurface;
}

function resolveViewSurfaceChange(
  id: string,
  isNativeOntology: boolean
): ViewSurface | undefined {
  if (id === 'graph' || id === 'tree') {
    return id;
  }

  return id === 'ontology' && isNativeOntology ? id : undefined;
}

function resolveQuerySurfaceChange(id: string): QuerySurface | undefined {
  return id === 'console' || id === 'builder'
    ? (id as QuerySurface)
    : undefined;
}

const DRAFT_SEARCH_PARAM = 'draft';

// A memory modal links straight to its draft, which opens Studio in review mode.
function useLinkedDraftId(): string | undefined {
  const [searchParams] = useSearchParams();

  return searchParams.get(DRAFT_SEARCH_PARAM) ?? undefined;
}

const studioModeFor = (linkedDraftId?: string): StudioMode =>
  linkedDraftId ? 'review' : 'view';

const resolveStudioMode = (
  urlState: StudioUrlState,
  linkedDraftId?: string
): StudioMode => urlState.mode ?? studioModeFor(linkedDraftId);

const canCreateNativeOntology = (
  isAdminUser: boolean | undefined,
  permissions: Parameters<typeof checkPermission>[2]
) =>
  Boolean(isAdminUser) ||
  checkPermission(Operation.Create, ResourceEntity.ONTOLOGY, permissions);

function getSelectedOntology(
  ontologyId: string | null,
  loadedOntology?: Ontology
): Ontology | undefined {
  return loadedOntology?.id === ontologyId ? loadedOntology : undefined;
}

function mergeSelectedOntology(
  ontologies: Ontology[],
  selectedOntology?: Ontology
): Ontology[] {
  if (
    !selectedOntology ||
    ontologies.some((ontology) => ontology.id === selectedOntology.id)
  ) {
    return ontologies;
  }

  return [selectedOntology, ...ontologies];
}

function getStudioScopeLabel(
  scope: OntologyStudioScope,
  selectedOntology: Ontology | undefined,
  selectedGlossary: Glossary | undefined,
  allGlossariesLabel: string,
  t: TFunction
): string {
  if (selectedOntology) {
    return getEntityName(selectedOntology);
  }
  if (scope.kind === 'ontology') {
    return t('label.ontology');
  }
  if (scope.kind === 'allOntologies') {
    return t('label.all-entity', {
      entity: t('label.ontology-plural').toLocaleLowerCase(),
    });
  }

  return getSelectedGlossaryLabel(selectedGlossary, allGlossariesLabel);
}

function shouldShowDefaultSurface(flags: StudioVisibilityFlags): boolean {
  return !(
    flags.showAiAssistant ||
    flags.showQuerySurface ||
    flags.showReviewSurface ||
    flags.showRdfDisabledNotice
  );
}

function getSubModeCaption(mode: StudioMode, t: TFunction): string {
  if (mode === 'view') {
    return t('label.explore');
  }
  if (mode === 'edit') {
    return t('label.author');
  }

  return t('label.query');
}

function getStudioStatsLabel(
  scope: OntologyStudioScope,
  aggregateGraph: OntologyGraphData | null,
  ontologyId: string | null,
  nativeStats: OntologyModelStats | undefined,
  termCount: string,
  relationCount: string,
  t: TFunction
): string {
  if (scope.kind === 'allOntologies') {
    if (!aggregateGraph) {
      return '';
    }

    return `${t('message.native-concept-count', {
      count: aggregateGraph.nodes.length,
    })} · ${t('message.native-relation-count', {
      count: aggregateGraph.edges.length,
    })}`;
  }
  if (scope.kind === 'ontology') {
    const currentStats =
      nativeStats?.ontologyId === ontologyId ? nativeStats : undefined;

    if (!currentStats) {
      return '';
    }

    return `${t('message.native-concept-count', {
      count: currentStats.conceptCount,
    })} · ${t('message.native-relation-count', {
      count: currentStats.relationCount,
    })}`;
  }

  return `${termCount} ${t(
    'label.term-plural'
  ).toLocaleLowerCase()} · ${relationCount} ${t(
    'label.relation-plural'
  ).toLocaleLowerCase()}`;
}

function getScopeGlossaryId(scope: OntologyStudioScope): string | undefined {
  return scope.kind === 'glossaries' ? scope.glossaryId : undefined;
}

function getIsolatedCount(
  stats: OntologyModelStats | undefined,
  ontology: Ontology | undefined
): number {
  return ontology && stats?.ontologyId === ontology.id
    ? stats.isolatedCount
    : 0;
}

function canEditStudioScope(
  scope: OntologyStudioScope,
  selectedOntology: Ontology | undefined,
  canEditGlossary: boolean
): boolean {
  if (scope.kind === 'allOntologies') {
    return true;
  }
  if (scope.kind === 'ontology') {
    return Boolean(selectedOntology);
  }

  return canEditGlossary;
}

function canShowEditTab(
  scope: OntologyStudioScope,
  rights: {
    canEditAnyOntology: boolean;
    canEditGlossary: boolean;
    canEditSelectedOntology: boolean;
    isEditing: boolean;
  }
): boolean {
  if (rights.isEditing) {
    return true;
  }
  if (scope.kind === 'allOntologies') {
    return rights.canEditAnyOntology;
  }
  if (scope.kind === 'ontology') {
    return rights.canEditSelectedOntology;
  }

  return rights.canEditGlossary;
}

function canShowPublicationTrigger(state: {
  canEditAnyOntology: boolean;
  canEditSelectedOntology: boolean;
  isAllOntologies: boolean;
  isBlocked: boolean;
  selectedOntology: Ontology | undefined;
}): boolean {
  if (state.isBlocked) {
    return false;
  }
  if (state.selectedOntology) {
    return state.canEditSelectedOntology;
  }

  return state.isAllOntologies && state.canEditAnyOntology;
}

interface NativeConceptRequest {
  key: number;
  ontologyId: string;
  handled?: boolean;
}

// A remounted graph must not replay a request it already opened, so a handled one reads as 0.
function pendingConceptRequestKey(
  request: NativeConceptRequest | undefined,
  ontologyId: string
) {
  return request?.ontologyId === ontologyId && !request.handled
    ? request.key
    : 0;
}

function nextConceptRequest(
  current: NativeConceptRequest | undefined,
  ontologyId: string
): NativeConceptRequest {
  return {
    key: current?.ontologyId === ontologyId ? current.key + 1 : 1,
    ontologyId,
  };
}

function aggregateEnabled(
  isAllOntologies: boolean,
  scopes: ReturnType<typeof useOntologyStudioScopes>
): boolean {
  return (
    isAllOntologies && !scopes.isOntologyLoading && !scopes.isOntologyError
  );
}

function useLoadedOntology(ontologyId: string | null) {
  const [loadedOntology, setLoadedOntology] = useState<Ontology>();
  const [ontologyLoadFailed, setOntologyLoadFailed] = useState(false);
  const [ontologyNotFound, setOntologyNotFound] = useState(false);
  const [ontologyLoadAttempt, setOntologyLoadAttempt] = useState(0);
  useEffect(() => {
    if (!ontologyId) {
      return;
    }
    if (loadedOntology?.id === ontologyId) {
      return;
    }
    const controller = new AbortController();
    setOntologyLoadFailed(false);
    setOntologyNotFound(false);
    getOntology(
      ontologyId,
      'owners,reviewers,publicationStatus',
      controller.signal
    )
      .then((ontology) => {
        if (!controller.signal.aborted) {
          setLoadedOntology(ontology);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        setLoadedOntology(undefined);
        if (isAxiosError(error) && error.response?.status === 404) {
          setOntologyNotFound(true);

          return;
        }
        showErrorToast(error);
        setOntologyLoadFailed(true);
      });

    return () => controller.abort();
  }, [loadedOntology?.id, ontologyId, ontologyLoadAttempt]);
  const reloadOntology = () => setOntologyLoadAttempt((attempt) => attempt + 1);

  return {
    loadedOntology,
    setLoadedOntology,
    ontologyLoadFailed,
    ontologyNotFound,
    reloadOntology,
  };
}

const idOrEmpty = (entity?: { id: string }) => entity?.id ?? '';

function canEditAnyNativeOntology(
  isAdminUser: boolean | undefined,
  permissions: ReturnType<typeof usePermissionProvider>['permissions']
): boolean {
  return (
    Boolean(isAdminUser) ||
    checkPermission(Operation.EditAll, ResourceEntity.ONTOLOGY, permissions)
  );
}

function isNativePermissionPending(
  mode: StudioMode,
  ontologyPending: boolean,
  conceptPending: boolean
): boolean {
  return ontologyPending || (mode === 'edit' && conceptPending);
}

const getHeaderActionSize = (isAiMode: boolean) => (isAiMode ? 'sm' : 'xs');

const OntologyExplorerContent: React.FC = () => {
  const guard = useOntologyDraftGuard();
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const { isAdminUser } = useAuth();
  const { permissions } = usePermissionProvider();
  const queryClient = useQueryClient();
  const userId = useApplicationStore((store) => store.currentUser?.id);
  const {
    isEnabled: isOntologyAiEnabled,
    isRdfEnabled,
    isLoading: isCapabilityLoading,
  } = useOntologyAiCapability();
  const initialDraftId = useLinkedDraftId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEmptyImportOpen, setIsEmptyImportOpen] = useState(false);
  const [pendingFirstClass, setPendingFirstClass] = useState<{
    ontologyId: string;
    isUrlReached: boolean;
  }>();
  const [isGlossaryScopeMenuOpen, setIsGlossaryScopeMenuOpen] = useState(false);
  const urlState = useMemo(
    () => parseStudioUrlState(searchParams),
    [searchParams]
  );
  const mode = resolveStudioMode(urlState, initialDraftId);
  const setStudioUrl = useCallback(
    (patch: StudioUrlState, options?: { replace?: boolean }) =>
      setSearchParams((current) => patchStudioUrlParams(current, patch), {
        replace: options?.replace,
      }),
    [setSearchParams]
  );
  const setMode = useCallback(
    (
      next: StudioMode,
      options?: { replace?: boolean; view?: StudioUrlView }
    ) => {
      if (next === 'review') {
        return;
      }
      setStudioUrl(
        {
          mode: next,
          view: options?.view,
          ...(next === 'edit' ? { version: undefined } : {}),
        },
        options
      );
    },
    [setStudioUrl]
  );
  const setViewSurface = useCallback(
    (surface: ViewSurface) => setStudioUrl({ view: surface }),
    [setStudioUrl]
  );
  const setEditSurface = useCallback(
    (surface: EditSurface) =>
      setStudioUrl({ view: surface === 'definitions' ? 'ontology' : surface }),
    [setStudioUrl]
  );
  const setQuerySurface = useCallback(
    (surface: QuerySurface) => setStudioUrl({ view: surface }),
    [setStudioUrl]
  );
  const studioScope = getStudioScope(searchParams);
  const isAllOntologies = studioScope.kind === 'allOntologies';
  const isGlossaryScope = studioScope.kind === 'glossaries';
  const ontologyId = searchParams.get('ontology');
  const selectedConceptId = searchParams.get('concept') ?? undefined;
  const selectNativeConcept = useCallback(
    (id?: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (id) {
            next.set('concept', id);
          } else {
            next.delete('concept');
          }

          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const selectedGlossaryId = getScopeGlossaryId(studioScope);
  const setSelectedGlossaryId = useCallback(
    (id?: string) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('ontology');
        const scopeKey = getScopeKey({ kind: 'glossaries', glossaryId: id });
        if (getScopeKey(getStudioScope(current)) !== scopeKey) {
          next.delete(DRAFT_SEARCH_PARAM);
        }
        next.set('scope', scopeKey);

        return next;
      });
    },
    [setSearchParams]
  );
  const {
    loadedOntology,
    setLoadedOntology,
    ontologyLoadFailed,
    ontologyNotFound,
    reloadOntology,
  } = useLoadedOntology(ontologyId);
  const selectedOntology = getSelectedOntology(ontologyId, loadedOntology);
  const canCreateOntology = canCreateNativeOntology(isAdminUser, permissions);
  const canEditAnyOntology = canEditAnyNativeOntology(isAdminUser, permissions);
  const selectedOntologyId = idOrEmpty(selectedOntology);
  const refreshNativeWorkingDiff = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY],
    });
    void queryClient.invalidateQueries({
      queryKey: [ONTOLOGY_STUDIO_MODEL_QUERY_KEY],
    });
    if (selectedOntologyId) {
      void queryClient.invalidateQueries({
        queryKey: [ONTOLOGY_WORKING_DIFF_QUERY_KEY, selectedOntologyId],
      });
    }
  }, [queryClient, selectedOntologyId]);
  const {
    canEditAll: canEditNativeOntology,
    isLoading: isNativeOntologyPermissionLoading,
  } = useEntityPermissions(
    ResourceEntity.ONTOLOGY,
    { id: selectedOntologyId },
    { enabled: Boolean(selectedOntology), deleted: selectedOntology?.deleted }
  );
  const canCreateNativeClass = [
    ResourceEntity.ONTOLOGY_CONCEPT,
    ResourceEntity.ONTOLOGY_CHANGE_SET,
  ].every(
    (resource) =>
      getDerivedPermissionFlags(
        permissions[resource] ?? DEFAULT_ENTITY_PERMISSION,
        selectedOntology?.deleted
      ).canCreate
  );
  const [publicationScopeKey, setPublicationScopeKey] = useState<string>();
  const [publicationTab, setPublicationTab] = useState<'changes' | 'releases'>(
    'changes'
  );
  const currentScopeKey = getScopeKey(studioScope);
  const [selectedReviewTaskId] = searchParams.getAll('task');
  const publicationIdentity = JSON.stringify([userId, currentScopeKey]);
  const isPublicationOpen = publicationScopeKey === publicationIdentity;
  const setIsPublicationOpen = (open: boolean) =>
    setPublicationScopeKey(open ? publicationIdentity : undefined);
  useEffect(() => {
    setPublicationScopeKey((key) =>
      !selectedReviewTaskId && key === publicationIdentity ? key : undefined
    );
  }, [publicationIdentity, selectedReviewTaskId]);

  const [settingsOntology, setSettingsOntology] = useState<Ontology>();
  const [stats, setStats] = useState<string[]>([]);
  const [glossaries, setGlossaries] = useState<Glossary[]>([]);
  const [graphData, setGraphData] = useState<OntologyGraphData | null>(null);
  const [relationTypes, setRelationTypes] = useState<RelationshipType[]>([]);
  const [authoringGlossaryId, setAuthoringGlossaryId] = useState<string>();
  const [pendingGlossaryName, setPendingGlossaryName] = useState<string>();
  const [explorerRevision, setExplorerRevision] = useState(0);
  const [generatedQuery, setGeneratedQuery] = useState<{
    scopeKey: string;
    query: string;
  }>();
  const [queryConsoleKey, setQueryConsoleKey] = useState(0);
  const [isNewQueryRequested, setIsNewQueryRequested] = useState(false);
  const [isQueryPickerOpen, setIsQueryPickerOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [nativeStats, setNativeStats] = useState<OntologyModelStats>();
  const [nativeRefresh, setNativeRefresh] = useState(0);
  const workspaceShownFor = useRef<string>();
  const [nativeAuthoringLocked, setNativeAuthoringLocked] = useState(false);
  const [isAggregateCreateOpen, setIsAggregateCreateOpen] = useState(false);
  const [nativeConceptRequest, setNativeConceptRequest] =
    useState<NativeConceptRequest>();
  const [searchSlot, setSearchSlot] = useState<HTMLDivElement | null>(null);
  const [conceptDraft, setConceptDraft] = useState<{
    defaultGlossaryId?: string;
    id: string;
  }>();
  const studioScopes = useOntologyStudioScopes({
    enabled: true,
    loadGlossaries: isGlossaryScopeMenuOpen,
    knownGlossaries: glossaries,
  });
  useEffect(() => {
    if (!isAllOntologies || mode !== 'edit') {
      setIsAggregateCreateOpen(false);
    }
  }, [isAllOntologies, mode]);
  const availableOntologies = useMemo(
    () => mergeSelectedOntology(studioScopes.ontologies, selectedOntology),
    [selectedOntology, studioScopes.ontologies]
  );

  const isCatalogEmpty = [
    isAllOntologies,
    !studioScopes.isOntologyLoading,
    !studioScopes.isOntologyError,
    availableOntologies.length === 0,
  ].every(Boolean);
  const isFirstListLoading = isAllOntologies && studioScopes.isOntologyLoading;

  const unpublishedCount = useOntologyUnpublishedCount(
    studioScopes.ontologies,
    aggregateEnabled(isAllOntologies, studioScopes)
  );
  const publicationStatus = studioScopes.ontologies.find(
    (owner) => owner.id === selectedOntologyId
  )?.publicationStatus;
  const allModels = useAllOntologyStudioModels(
    studioScopes.ontologies,
    aggregateEnabled(isAllOntologies, studioScopes)
  );

  const aggregateHealth = useMemo(
    () =>
      ![
        allModels.isError,
        allModels.isLoading,
        studioScopes.isOntologyError,
        studioScopes.isOntologyLoading,
      ].some(Boolean) && allModels.graph
        ? getOntologyHealthSummary(allModels.graph, NATIVE_FILTERS)
        : undefined,
    [
      allModels.graph,
      allModels.isError,
      allModels.isLoading,
      studioScopes.isOntologyError,
      studioScopes.isOntologyLoading,
    ]
  );

  const selectOntology = (
    ontology?: Ontology,
    conceptId?: string,
    nextMode: StudioMode = 'view',
    nextView?: StudioUrlView
  ) => {
    if (nativeAuthoringLocked) {
      showErrorToast(t('message.ontology-class-attempt-pending'));

      return;
    }
    setIsPublicationOpen(false);
    setLoadedOntology(undefined);
    reloadOntology();
    setSearchParams((current) => {
      let next = new URLSearchParams(current);
      if ((ontology?.id ?? null) !== current.get('ontology')) {
        next.delete(DRAFT_SEARCH_PARAM);
      }
      next.delete('scope');
      if (conceptId) {
        next.set('concept', conceptId);
      } else {
        next.delete('concept');
      }
      if (ontology) {
        next.set('ontology', ontology.id);
      } else {
        next.delete('ontology');
      }
      next = patchStudioUrlParams(next, {
        mode: nextMode === 'review' ? undefined : nextMode,
        view: nextView,
        version: undefined,
      });

      return next;
    });
  };
  useEffect(() => {
    if (!pendingFirstClass) {
      return;
    }
    const pendingId = pendingFirstClass.ontologyId;
    if (ontologyId !== pendingId) {
      if (pendingFirstClass.isUrlReached) {
        setPendingFirstClass(undefined);
      }
    } else if (selectedOntology?.id === pendingId && mode === 'edit') {
      setPendingFirstClass(undefined);
      setNativeConceptRequest((current) =>
        nextConceptRequest(current, pendingId)
      );
    } else if (!pendingFirstClass.isUrlReached) {
      setPendingFirstClass({ ontologyId: pendingId, isUrlReached: true });
    }
  }, [mode, ontologyId, pendingFirstClass, selectedOntology?.id]);
  const handleStatsChange = useCallback((newStats: string[]) => {
    setStats(newStats);
  }, []);

  const handleGlossariesChange = useCallback((items: Glossary[]) => {
    setGlossaries(items);
  }, []);

  const handleOpenGlossary = useCallback(
    (glossaryName: string) => {
      setPendingGlossaryName(glossaryName);
      setIsLibraryOpen(false);
      setStudioUrl({ mode: 'view', view: undefined, version: undefined });
      setExplorerRevision((revision) => revision + 1);
    },
    [setStudioUrl]
  );

  useEffect(() => {
    const targetGlossary = glossaries.find(
      (glossary) => glossary.name === pendingGlossaryName
    );

    if (targetGlossary) {
      setSelectedGlossaryId(targetGlossary.id);
      setPendingGlossaryName(undefined);
    }
  }, [glossaries, pendingGlossaryName, setSelectedGlossaryId]);

  const handleGraphDataChange = useCallback((data: OntologyGraphData) => {
    setGraphData(data);
  }, []);

  const handleRelationTypesChange = useCallback((items: RelationshipType[]) => {
    setRelationTypes(items);
  }, []);

  const allGlossariesLabel = useMemo(() => {
    const label = t('label.all-glossaries');

    return `${label.charAt(0)}${label.slice(1).toLocaleLowerCase()}`;
  }, [t]);
  const scopeGlossaries = studioScopes.glossaries;
  const selectedGlossary = glossaries.find(
    (glossary) => glossary.id === selectedGlossaryId
  );
  const selectedScopeGlossary = scopeGlossaries.find(
    (glossary) => glossary.id === selectedGlossaryId
  );
  const isNativeOntology = isOntologyScope(studioScope);
  // Same key as the graph view's read of this concept, so React Query makes one request.
  const {
    canEditAll: canEditSelectedConcept,
    isLoading: isConceptPermissionLoading,
  } = useEntityPermissions(
    ResourceEntity.ONTOLOGY_CONCEPT,
    { id: selectedConceptId ?? '' },
    { enabled: isNativeOntology && Boolean(selectedConceptId) }
  );
  // Only Edit depends on the concept read; View must not unmount on each selection.
  const isNativePermissionLoading = isNativePermissionPending(
    mode,
    isNativeOntologyPermissionLoading,
    isConceptPermissionLoading
  );
  const [editConceptRequest, setEditConceptRequest] = useState<string>();
  // All ontologies offers Tree and Ontology too; the Ontology surface there asks which one to open.
  const hasOntologySurfaces = offersOntologySurfaces(studioScope);
  const viewSurface = resolveViewSurface(urlState.view, hasOntologySurfaces);
  const editSurface = resolveEditSurface(urlState.view, hasOntologySurfaces);
  const querySurface = resolveQuerySurface(urlState.view);
  const aggregateSurface = getAggregateSurface(mode, viewSurface, editSurface);
  const isFullScreen = searchParams.get(FULLSCREEN_QUERY_PARAM_KEY) === 'true';
  const [drawerHost, setDrawerHost] = useState<HTMLElement | null>(null);
  const [lastQuerySurface, setLastQuerySurface] =
    useState<QuerySurface>('console');
  useEffect(() => {
    if (mode === 'query') {
      setLastQuerySurface(querySurface);
    }
  }, [mode, querySurface]);
  const scopeLabel = getStudioScopeLabel(
    studioScope,
    selectedOntology,
    selectedScopeGlossary,
    allGlossariesLabel,
    t
  );

  const authoringGlossary = glossaries.find(
    (glossary) => glossary.id === authoringGlossaryId
  );
  const graphLeaseGlossary = resolveGraphLeaseGlossary(
    selectedGlossary,
    authoringGlossary
  );
  const leaseGlossary = resolveLeaseGlossary(
    conceptDraft,
    authoringGlossary,
    graphLeaseGlossary,
    glossaries
  );

  function isGlossaryEditMode() {
    return isGlossaryScope && mode === 'edit' && Boolean(leaseGlossary);
  }

  const editLease = useOntologyEditLease({
    isActive: isGlossaryEditMode(),
    resourceId: leaseGlossary?.id,
    resourceType: EntityType.GLOSSARY,
  });
  const { isLeaseForCurrentGlossary, isLeaseOwned } = getLeaseOwnership(
    editLease,
    leaseGlossary
  );
  const editLeaseState = getEditLeaseState(
    editLease.isOwned,
    isLeaseForCurrentGlossary,
    editLease.state
  );
  // Already in Edit without the lease (another session holds it): asking to
  // edit again retries the lease and says who is holding it.
  const handleRequestEdit = () => {
    setMode('edit');
    if (mode !== 'edit' || isLeaseOwned) {
      return;
    }
    editLease.retry();
    if (editLease.state === 'contended') {
      showInfoToast(
        t('message.ontology-edit-held-by', {
          holder:
            editLease.lock?.holder.displayName ??
            editLease.lock?.holder.name ??
            t('label.user'),
        })
      );
    }
  };

  const selectedGlossaryIds = useMemo(
    () => (selectedGlossaryId ? [selectedGlossaryId] : []),
    [selectedGlossaryId]
  );
  const termCount = getStatCount(stats, t('label.term-plural'));
  const relationCount = getStatCount(stats, t('label.relation-plural'));
  const statsLabel = getStudioStatsLabel(
    studioScope,
    allModels.graph,
    ontologyId,
    nativeStats,
    termCount,
    relationCount,
    t
  );

  const explorerSurface = getExplorerSurface(
    mode,
    viewSurface,
    editSurface,
    isNativeOntology
  );

  const canEditOntology = computeCanEditOntology(isAdminUser, permissions);
  const changeSetPermissions = computeChangeSetPermissions(
    isAdminUser,
    permissions
  );
  // Approving applies the draft to its glossaries and edits the draft itself
  // under a change-set lease, so it needs both permissions.
  const proposalPermissions = useMemo(
    () => ({
      canApprove: Boolean(
        changeSetPermissions.canApply && changeSetPermissions.canDiscard
      ),
      canReject: Boolean(changeSetPermissions.canDiscard),
    }),
    [changeSetPermissions.canApply, changeSetPermissions.canDiscard]
  );
  const canCreateConcept = computeCanCreateConcept(
    isAdminUser,
    permissions,
    canEditOntology
  );
  // Native child permissions are entity-scoped; each editor authorizes its own writes.
  const canEditCurrentScope = canEditStudioScope(
    studioScope,
    selectedOntology,
    canEditOntology
  );
  // A concept owner reaches Edit from the concept panel without ontology-level
  // rights, so the tab also shows while that session is open.
  const showEditTab = canShowEditTab(studioScope, {
    canEditAnyOntology,
    canEditGlossary: canEditOntology,
    canEditSelectedOntology: canEditNativeOntology,
    isEditing: mode === 'edit',
  });
  const {
    canOfferEdit,
    isVersionPending,
    publishedReleaseId,
    releaseStatus,
    version,
  } = resolveStudioRead({
    canEdit: canEditNativeOntology,
    isPermissionLoading: isNativePermissionLoading,
    mode,
    isNativeOntology,
    listedStatus: publicationStatus,
    requestedVersion: urlState.version,
    selectedOntology,
    showEditTab,
  });
  const isOntologyAiAvailable = isGlossaryScope && isOntologyAiEnabled;
  const modeTabs = computeModeTabs(t, canOfferEdit, isOntologyAiAvailable);

  const canEnterEdit = canEnterEditMode(
    canEditCurrentScope,
    isNativeOntology,
    canEditNativeOntology,
    canEditSelectedConcept
  );

  useEffect(() => {
    if ((ontologyId && !selectedOntology) || isVersionPending) {
      return;
    }
    const isUnavailableEditMode = mode === 'edit' && !canEnterEdit;
    const isUnavailableAiMode =
      mode === 'ai' && (isNativeOntology || !isOntologyAiEnabled);
    if (isUnavailableEditMode || isUnavailableAiMode) {
      setMode('view', { replace: true });
    }
  }, [
    canEnterEdit,
    isNativeOntology,
    isOntologyAiEnabled,
    isVersionPending,
    mode,
    ontologyId,
    selectedOntology,
    setMode,
  ]);

  const subModeConfiguration = getSubModeConfiguration(
    mode,
    { editSurface, querySurface, viewSurface },
    isRdfEnabled,
    isNativeOntology,
    hasOntologySurfaces,
    t
  );

  const handleSubModeChange = useCallback(
    (id: string) => {
      if (nativeAuthoringLocked) {
        showErrorToast(t('message.ontology-class-attempt-pending'));

        return;
      }
      if (
        mode === 'edit' &&
        (id === 'graph' || id === 'tree' || id === 'definitions')
      ) {
        setEditSurface(id);
      }
      if (mode === 'view') {
        const nextViewSurface = resolveViewSurfaceChange(
          id,
          hasOntologySurfaces
        );
        if (nextViewSurface) {
          setViewSurface(nextViewSurface);
        }

        return;
      }
      if (mode === 'query') {
        const nextQuerySurface = resolveQuerySurfaceChange(id);
        if (nextQuerySurface) {
          setQuerySurface(nextQuerySurface);
        }
      }
    },
    [
      hasOntologySurfaces,
      mode,
      nativeAuthoringLocked,
      setEditSurface,
      setQuerySurface,
      setViewSurface,
      t,
    ]
  );

  const {
    showAiAssistant,
    showHealth,
    showQuerySurface,
    showReviewSurface,
    showRdfDisabledNotice,
  } = computeVisibilityFlags(
    mode,
    isOntologyAiAvailable,
    isNativeOntology || isRdfEnabled,
    isCapabilityLoading
  );

  const showDefaultSurface = shouldShowDefaultSurface({
    showAiAssistant,
    showHealth,
    showQuerySurface,
    showReviewSurface,
    showRdfDisabledNotice,
  });

  const defaultModeContent = (
    <OntologyExplorer
      className="tw:min-h-0 tw:flex-1"
      conceptDraftId={conceptDraft?.id}
      defaultConceptGlossaryId={conceptDraft?.defaultGlossaryId}
      globalGlossaryIds={selectedGlossaryIds}
      height="100%"
      isAuthoringMode={mode === 'edit'}
      isEditMode={mode === 'edit' && isLeaseOwned}
      key={explorerRevision}
      proposalPermissions={proposalPermissions}
      scope="global"
      searchSlot={searchSlot}
      showHealth={showHealth}
      surface={explorerSurface === 'ontology' ? 'graph' : explorerSurface}
      onConceptCreated={(concept) => {
        setConceptDraft(undefined);
        if (concept.glossary?.id) {
          setSelectedGlossaryId(concept.glossary.id);
        }
      }}
      onConceptDraftClose={() => setConceptDraft(undefined)}
      onGlossariesChange={handleGlossariesChange}
      onGraphDataChange={handleGraphDataChange}
      onRelationTypesChange={handleRelationTypesChange}
      onRequestEdit={handleRequestEdit}
      onSelectedNodeChange={(node) => setAuthoringGlossaryId(node?.glossaryId)}
      onStatsChange={handleStatsChange}
    />
  );

  function handleScopeChange(nextScope: OntologyStudioScope) {
    if (nativeAuthoringLocked) {
      showErrorToast(t('message.ontology-class-attempt-pending'));

      return;
    }
    setIsPublicationOpen(false);
    setIsLibraryOpen(false);
    if (nextScope.kind === 'allOntologies') {
      setLoadedOntology(undefined);
      setConceptDraft(undefined);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('ontology');
        next.delete('scope');
        next.delete(DRAFT_SEARCH_PARAM);
        next.delete('concept');

        return patchStudioUrlParams(next, {
          mode: 'view',
          view: undefined,
          version: undefined,
        });
      });
      void queryClient.invalidateQueries({
        queryKey: ['ontology-studio-model', 'all'],
      });

      return;
    }
    if (isOntologyScope(nextScope)) {
      const ontology = availableOntologies.find(
        (item) => item.id === nextScope.ontologyId
      );
      if (ontology) {
        selectOntology(ontology);
      }

      return;
    }

    const domainChanged = !isGlossaryScope;
    const scopeChanged =
      domainChanged || selectedGlossaryId !== nextScope.glossaryId;
    setLoadedOntology(undefined);
    if (scopeChanged) {
      setConceptDraft(undefined);
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('ontology');
      next.delete('concept');
      next.set('scope', getScopeKey(nextScope));
      if (scopeChanged) {
        next.delete(DRAFT_SEARCH_PARAM);
      }

      return domainChanged
        ? patchStudioUrlParams(next, {
            mode: 'view',
            view: undefined,
            version: undefined,
          })
        : next;
    });
  }

  function handleModeChange(nextMode: StudioMode, editView?: StudioUrlView) {
    if (nativeAuthoringLocked) {
      showErrorToast(t('message.ontology-class-attempt-pending'));

      return;
    }
    if (isAllOntologies && nextMode === 'edit') {
      const owner = allModels.models?.find((model) =>
        model.concepts.some((concept) => concept.id === selectedConceptId)
      );
      if (owner) {
        selectOntology(owner.ontology, selectedConceptId, 'edit');

        return;
      }
    }
    if (nextMode !== 'edit') {
      setConceptDraft(undefined);
    }
    setMode(nextMode, {
      view: nextMode === 'query' ? lastQuerySurface : editView,
    });
  }

  function renderScopeMenu() {
    return (
      <OntologyStudioScopeMenu
        glossaries={scopeGlossaries}
        isError={
          isGlossaryScope ? studioScopes.isError : studioScopes.isOntologyError
        }
        isLoading={
          isGlossaryScope
            ? studioScopes.isLoading
            : studioScopes.isOntologyLoading
        }
        label={scopeLabel}
        ontologies={availableOntologies}
        scope={studioScope}
        onCreateOntology={
          canCreateOntology && !nativeAuthoringLocked
            ? () =>
                guard(() => {
                  handleModeChange('view');
                  setIsCreateDialogOpen(true);
                })
            : undefined
        }
        onEditOntology={
          canEditCurrentScope && !isAllOntologies
            ? () => handleModeChange('edit')
            : undefined
        }
        onOntologyDeleted={(deleted) => {
          if (deleted.id === selectedOntologyId) {
            handleScopeChange(ALL_ONTOLOGIES_SCOPE);
          }
        }}
        onOpenChange={(open) =>
          setIsGlossaryScopeMenuOpen(open && isGlossaryScope)
        }
        onOpenSettings={(ontology) =>
          guard(() => setSettingsOntology(ontology))
        }
        onRetry={() =>
          void (isGlossaryScope
            ? studioScopes.refetch()
            : studioScopes.refetchOntologies())
        }
        onScopeChange={(scope) => guard(() => handleScopeChange(scope))}
      />
    );
  }

  function handleAddConcept() {
    if (isAllOntologies) {
      setIsAggregateCreateOpen(true);

      return;
    }
    if (isNativeOntology) {
      setNativeConceptRequest((current) =>
        nextConceptRequest(current, ontologyId ?? '')
      );

      return;
    }

    const defaultGlossaryId = graphLeaseGlossary?.id;
    setAuthoringGlossaryId(defaultGlossaryId);
    setConceptDraft({
      defaultGlossaryId,
      id: `ontology-concept-draft-${generateUUID()}`,
    });
  }

  const publishReasonId = useId();
  const addConceptReasonId = useId();
  const headerActionSize = getHeaderActionSize(isAiMode);

  // View on one ontology offers the step into Edit where Add concept would sit.
  function renderEditOntologyAction() {
    const canStartEditing = [
      isNativeOntology,
      Boolean(selectedOntology),
      canOfferEdit,
      canEnterEdit,
    ].every(Boolean);

    return canStartEditing ? (
      <Button
        color="primary"
        data-testid="ontology-edit-ontology"
        iconTrailing={ArrowRight}
        size={headerActionSize}
        onPress={() => guard(() => handleModeChange('edit'))}>
        {t('label.edit-entity', { entity: t('label.ontology') })}
      </Button>
    ) : null;
  }

  function renderNewQueryAction() {
    // All ontologies only lists native ontologies, which are queried without the RDF store.
    if (!isNativeOntology && !isAllOntologies && !isRdfEnabled) {
      return null;
    }

    return (
      <Button
        color="primary"
        data-testid="ontology-new-query"
        iconLeading={Plus}
        size={headerActionSize}
        onPress={() => {
          // A query needs one ontology, so on All ontologies this only offers the choice.
          if (isAllOntologies) {
            setIsQueryPickerOpen(true);

            return;
          }
          setGeneratedQuery(undefined);
          setIsNewQueryRequested(true);
          setQuerySurface('console');
          setQueryConsoleKey((key) => key + 1);
        }}>
        {t('label.new-entity', {
          entity: t('label.query').toLocaleLowerCase(),
        })}
      </Button>
    );
  }

  function renderPrimaryAction() {
    const canAddConcept = (() => {
      if (isAllOntologies) {
        return canCreateNativeClass && availableOntologies.length > 0;
      }

      return isNativeOntology
        ? canCreateNativeClass &&
            canEditNativeOntology &&
            mountsGraphView(editSurface)
        : canCreateConcept;
    })();

    if (mode === 'edit' && canAddConcept) {
      const isDraftOpen = !isNativeOntology && Boolean(conceptDraft);

      return (
        <>
          <Button
            aria-describedby={isDraftOpen ? addConceptReasonId : undefined}
            color="primary"
            data-testid="ontology-add-concept"
            iconLeading={Plus}
            isDisabled={isDraftOpen}
            size={headerActionSize}
            onPress={() => guard(handleAddConcept)}>
            {t('label.add-entity', {
              entity: t('label.concept').toLocaleLowerCase(),
            })}
          </Button>
          {isDraftOpen && (
            <Typography
              as="span"
              className="tw:font-body tw:text-xs tw:text-tertiary"
              data-testid="ontology-add-concept-reason"
              id={addConceptReasonId}>
              {t('message.ontology-finish-open-concept-first')}
            </Typography>
          )}
        </>
      );
    }

    if (mode === 'view') {
      return renderEditOntologyAction();
    }

    return mode === 'query' ? renderNewQueryAction() : null;
  }

  function publicationPendingCount() {
    if (studioScopes.isOntologyError) {
      return t('label.unavailable');
    }
    if (isAllOntologies) {
      if (unpublishedCount.status === 'unavailable') {
        return t('label.unavailable');
      }

      return unpublishedCount.status === 'ready'
        ? String(unpublishedCount.count)
        : t('label.loading');
    }
    if (studioScopes.isOntologyLoading) {
      return t('label.loading');
    }

    return publicationStatus?.unpublishedChanges === undefined
      ? t('label.unavailable')
      : String(publicationStatus.unpublishedChanges);
  }

  function renderPublicationLabel() {
    if (isAllOntologies) {
      return t('label.review-publish');
    }

    return (
      <span className="tw:whitespace-nowrap">
        {t('label.publish')} (
        <span data-testid="ontology-publication-count">
          {publicationPendingCount()}
        </span>
        )
      </span>
    );
  }

  const canShowPublication = canShowPublicationTrigger({
    canEditAnyOntology,
    canEditSelectedOntology: canEditNativeOntology,
    isAllOntologies,
    isBlocked: isCatalogEmpty || isFirstListLoading,
    selectedOntology,
  });

  function renderPublicationActions() {
    if (!canShowPublication) {
      return null;
    }
    const isolatedCount = isAllOntologies
      ? aggregateHealth?.isolatedTerms.length ?? 0
      : getIsolatedCount(nativeStats, selectedOntology);

    return (
      <>
        {/* Tooltip, not the Button prop: it keeps hover working while the button is disabled. */}
        <Tooltip
          isDisabled={!isAllOntologies}
          title={t('message.ontology-choose-ontology-to-publish')}>
          <Button
            aria-describedby={isAllOntologies ? publishReasonId : undefined}
            color="primary"
            data-testid="ontology-publication-trigger"
            iconLeading={GitBranch01}
            isDisabled={isAllOntologies}
            size={headerActionSize}
            onPress={() => {
              setPublicationTab('changes');
              setIsPublicationOpen(true);
            }}>
            {renderPublicationLabel()}
          </Button>
        </Tooltip>
        {isAllOntologies && (
          <span
            className="tw:sr-only"
            data-testid="ontology-publication-reason"
            id={publishReasonId}>
            {t('message.ontology-choose-ontology-to-publish')}
          </span>
        )}
        {/* The AI header leaves the isolated count to the health card. */}
        {!isAiMode && isolatedCount > 0 && (
          <BadgeWithDot color="warning" size="sm">
            {isolatedCount} {t('label.isolated')}
          </BadgeWithDot>
        )}
      </>
    );
  }

  function renderLibraryTrigger() {
    return (
      <Button
        aria-haspopup="dialog"
        aria-label={t('label.library')}
        color="secondary"
        data-testid="ontology-library-trigger"
        iconLeading={
          isAiMode ? Grid01 : <Grid01 className="tw:text-fg-brand-primary" />
        }
        size="sm"
        tooltip={t('label.library')}
        tooltipPlacement="bottom"
        onPress={() =>
          guard(() => {
            if (isNativeOntology) {
              handleModeChange('view');
            }
            setIsLibraryOpen(true);
          })
        }
      />
    );
  }

  function selectReviewTask(taskId?: string) {
    setIsPublicationOpen(false);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (taskId) {
        next.set('task', taskId);
      } else {
        next.delete('task');
      }

      return next;
    });
  }

  function renderImportExport() {
    return (
      <>
        {isNativeOntology && selectedOntology ? (
          <OntologyImportExportMenu
            canImport={canEditNativeOntology}
            key={String(userId) + selectedOntology.id}
            kind="ontology"
            ontology={selectedOntology}
            onApplied={() => {
              setNativeStats(undefined);
              setNativeRefresh((value) => value + 1);
              refreshNativeWorkingDiff();
            }}
            onOpen={() => handleModeChange('view')}
          />
        ) : null}
        {isAllOntologies ? (
          <OntologyImportExportMenu
            isCatalogEmpty={isCatalogEmpty}
            key={String(userId) + currentScopeKey}
            kind="allOntologies"
            ontologies={availableOntologies}
            onApplied={() => {
              void studioScopes.refetchOntologies();
              void allModels.refetch();
              refreshNativeWorkingDiff();
            }}
          />
        ) : null}
        {isGlossaryScope ? (
          <OntologyImportExportMenu
            glossaries={glossaries}
            glossary={selectedGlossary}
            isAdminUser={Boolean(isAdminUser)}
            kind="glossary"
            relationCount={relationCount}
            termCount={termCount}
          />
        ) : null}
      </>
    );
  }

  // In AI mode Tasks sits in the sub-bar; with no sub-bar it stays in the header so it is never lost.
  function showsTasksInSubBar() {
    return [
      isAiMode,
      mode !== 'ai' && mode !== 'review',
      !(ontologyId && !selectedOntology),
      !isCatalogEmpty,
    ].every(Boolean);
  }

  function renderHeader(tasksAction: React.ReactNode) {
    return (
      <OntologyStudioHeader
        actions={
          <Box align="center" gap={2} wrap="wrap">
            {renderLibraryTrigger()}
            {renderImportExport()}
            {renderPrimaryAction()}
            {renderPublicationActions()}
            {showsTasksInSubBar() ? null : tasksAction}
          </Box>
        }
        breadcrumb={
          isAiMode && isGlossaryScope ? (
            <HeaderBreadcrumb
              noMargin
              items={
                isGlossaryScope
                  ? [
                      getGlossaryHomeCrumb(t),
                      { label: t('label.ontology-studio') },
                    ]
                  : [{ label: t('label.ontology-studio') }]
              }
              showHome={false}
            />
          ) : undefined
        }
        mode={mode}
        modes={isCatalogEmpty || isFirstListLoading ? [] : modeTabs}
        scopeMenu={renderScopeMenu()}
        onModeChange={(mode) => guard(() => handleModeChange(mode))}
      />
    );
  }

  function handleVersionChange(next: StudioUrlVersion) {
    if (next === 'published') {
      setConceptDraft(undefined);
      setStudioUrl({
        version: 'published',
        ...(mode === 'edit' ? { mode: 'view' as const } : {}),
      });

      return;
    }
    setStudioUrl({ version: undefined });
  }

  function renderVersionChip() {
    return selectedOntology ? (
      <OntologyVersionChip
        isDisabled={
          studioScopes.isOntologyLoading || studioScopes.isOntologyError
        }
        status={publicationStatus}
        version={canEditNativeOntology ? version : undefined}
        onPress={() => {
          setPublicationTab('releases');
          setIsPublicationOpen(true);
        }}
        onVersionChange={
          canEditNativeOntology
            ? (next) => guard(() => handleVersionChange(next))
            : undefined
        }
      />
    ) : null;
  }

  function renderSearchSlot() {
    const hasNativeSlot =
      !isGlossaryScope && (mode === 'view' || mode === 'edit');
    if (!(isGlossaryScope && showDefaultSurface) && !hasNativeSlot) {
      return null;
    }

    return (
      <div
        // As wide as the search field it hosts (w-54), so it never runs into the next button.
        className="tw:w-54 tw:shrink tw:empty:hidden"
        data-testid="ontology-canvas-search-slot"
        ref={setSearchSlot}
      />
    );
  }

  function toggleFullScreen() {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (isFullScreen) {
        next.delete(FULLSCREEN_QUERY_PARAM_KEY);
      } else {
        next.set(FULLSCREEN_QUERY_PARAM_KEY, 'true');
      }

      return next;
    });
  }

  // The floating toolbar along the canvas bottom: version, search and full screen.
  function renderCanvasToolbar() {
    if (mode !== 'view' && mode !== 'edit') {
      return null;
    }
    const fullScreenLabel = t(
      isFullScreen ? 'label.exit-full-screen' : 'label.full-screen-view'
    );

    return (
      <div
        className={classNames(
          'tw:pointer-events-none tw:absolute tw:inset-x-0 tw:bottom-3 tw:z-20 tw:flex tw:justify-center tw:pl-4 tw:pr-4',
          // An open Studio drawer covers the canvas's right; centre in what is left so full screen stays reachable.
          'tw:group-has-[[data-studio-drawer]]/studio:pr-[calc(max(40vw,26.25rem)+1rem)]'
        )}
        data-testid="ontology-canvas-toolbar">
        <Box
          align="center"
          className="tw:pointer-events-auto tw:max-w-full tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:p-1.5 tw:shadow-lg"
          gap={2}>
          {renderVersionChip()}
          {renderSearchSlot()}
          <Button
            aria-label={fullScreenLabel}
            color="secondary"
            data-testid="ontology-full-screen"
            iconLeading={isFullScreen ? Minimize02 : Expand05}
            size="sm"
            tooltip={fullScreenLabel}
            onPress={toggleFullScreen}
          />
        </Box>
      </div>
    );
  }

  function renderSubModeNav(tasksAction?: React.ReactNode) {
    if (mode === 'ai' || mode === 'review') {
      return null;
    }

    const caption = getSubModeCaption(mode, t);

    return (
      <OntologyStudioSubBar
        caption={caption}
        surface={subModeConfiguration.id}
        surfaces={subModeConfiguration.items}
        trailing={
          <Box align="center" gap={3}>
            {!isNativeOntology && mode === 'edit' && leaseGlossary ? (
              <OntologyEditLeaseStatus
                hasResource
                lock={editLease.lock}
                state={editLeaseState}
                onRetry={editLease.retry}
              />
            ) : null}
            <Typography
              className="tw:whitespace-nowrap"
              color="secondary"
              data-testid="ontology-explorer-stats"
              size="text-sm">
              {statsLabel}
            </Typography>
            {showsTasksInSubBar() && tasksAction ? (
              <>
                <Divider className="tw:h-6" orientation="vertical" />
                {tasksAction}
              </>
            ) : null}
          </Box>
        }
        onSurfaceChange={(surface) =>
          guard(() => handleSubModeChange(surface))
        }>
        {mode === 'query' ? renderVersionChip() : null}
      </OntologyStudioSubBar>
    );
  }

  function renderQuerySurface() {
    // Queries follow the version the Studio reads: a reader is held to the active release,
    // an editor to whatever the Draft and Published switch shows.
    const queryScope =
      isNativeOntology && selectedOntology
        ? {
            ontologyName: getEntityName(selectedOntology),
            version,
            releaseVersion: releaseStatus?.active?.semanticVersion,
          }
        : undefined;

    return (
      <div className="tw:min-h-0 tw:min-w-0 tw:flex-1 tw:overflow-auto">
        {querySurface === 'console' ? (
          <OntologyStudioQueryConsole
            createQueryOnMount={isNewQueryRequested}
            graphData={isNativeOntology ? null : graphData}
            initialQuery={
              generatedQuery?.scopeKey === currentScopeKey
                ? generatedQuery.query
                : undefined
            }
            key={queryConsoleKey}
            queryScope={queryScope}
            relationTypes={isNativeOntology ? [] : relationTypes}
            selectedGlossaryIds={isNativeOntology ? [] : selectedGlossaryIds}
            selectedOntologyId={selectedOntology?.id}
            onQueryCreated={() => setIsNewQueryRequested(false)}
          />
        ) : (
          <OntologyVisualQueryBuilder
            graphData={isNativeOntology ? undefined : graphData}
            ontology={isNativeOntology ? selectedOntology : undefined}
            queryScope={queryScope}
            relationTypes={relationTypes}
            selectedGlossaryIds={selectedGlossaryIds}
            onEditAsSparql={(query) => {
              setGeneratedQuery({ scopeKey: currentScopeKey, query });
              setQuerySurface('console');
            }}
          />
        )}
      </div>
    );
  }

  function renderMainContent() {
    if (showReviewSurface) {
      return (
        <OntologyMemoryReviewPanel
          canApply={changeSetPermissions.canApply}
          canDiscard={changeSetPermissions.canDiscard}
          canSubmit={changeSetPermissions.canSubmit}
          initialDraftId={initialDraftId}
          onApplied={() => setExplorerRevision((revision) => revision + 1)}
        />
      );
    }

    if (showAiAssistant) {
      return (
        <OntologyAiAssistant
          canCreateDraft={canEditOntology}
          glossary={selectedGlossary}
          graphData={graphData}
          relationshipTypes={relationTypes}
          onOpenQuery={(query) => {
            setGeneratedQuery({ scopeKey: currentScopeKey, query });
            setMode('query', { view: 'console' });
          }}
        />
      );
    }

    if (showRdfDisabledNotice) {
      return <RdfDisabledNotice />;
    }

    if (showQuerySurface) {
      return renderQuerySurface();
    }

    return null;
  }

  function renderMainSection() {
    return (
      <section
        className={classNames(
          'tw:flex tw:min-h-0 tw:flex-1',
          mode === 'query' || mode === 'ai' || mode === 'review'
            ? 'tw:bg-secondary'
            : 'tw:bg-primary'
        )}>
        {/* Query and AI must not discard the loaded graph or restart its requests. */}
        <div
          className={classNames(
            'tw:min-h-0 tw:min-w-0 tw:flex-1',
            showDefaultSurface ? 'tw:flex' : 'tw:hidden'
          )}
          hidden={!showDefaultSurface}>
          {defaultModeContent}
        </div>
        {renderMainContent()}
      </section>
    );
  }

  const renderNothingPublished = () =>
    releaseStatus || !studioScopes.isOntologyLoading ? (
      <div
        className="tw:relative tw:min-h-70 tw:flex-1"
        data-testid="ontology-nothing-published">
        <NoDataPlaceholder
          description={t('message.ontology-nothing-published-description')}
          title={t('message.ontology-nothing-published')}
        />
      </div>
    ) : (
      <Loader />
    );

  const renderReadGate = (ontologyId: string) => {
    // Once the workspace is up, a later permission read (selecting a concept
    // in Edit) must not unmount it, or the graph loses placed nodes and layout.
    if (isVersionPending && workspaceShownFor.current !== ontologyId) {
      return <Loader />;
    }

    return mode === 'view' && version === 'published' && !publishedReleaseId
      ? renderNothingPublished()
      : null;
  };

  const renderNativeContent = (ontology: Ontology) => {
    if (mode === 'query' || mode === 'ai') {
      return renderMainContent();
    }
    const gate = renderReadGate(ontology.id);
    if (gate) {
      return gate;
    }
    workspaceShownFor.current = ontology.id;

    return (
      <OntologyStudioWorkspace
        createConceptRequestKey={pendingConceptRequestKey(
          nativeConceptRequest,
          ontology.id
        )}
        editConceptRequest={editConceptRequest}
        initialDraftId={initialDraftId}
        key={`${ontology.id}:${nativeRefresh}:${publishedReleaseId ?? 'draft'}`}
        mode={
          mode === 'edit' && editSurface === 'definitions'
            ? 'definitions'
            : mode
        }
        ontology={ontology}
        publicationStatus={releaseStatus}
        releaseId={publishedReleaseId}
        selectedConceptId={selectedConceptId}
        viewSurface={explorerSurface}
        onAuthoringLockChange={setNativeAuthoringLocked}
        onCreateConceptRequestHandled={() =>
          setNativeConceptRequest((current) =>
            current ? { ...current, handled: true } : current
          )
        }
        onEditConceptRequestHandled={() => setEditConceptRequest(undefined)}
        onOpenPublication={() => {
          setPublicationTab('changes');
          setIsPublicationOpen(true);
        }}
        onRequestCreateConcept={() => guard(handleAddConcept)}
        onRequestEdit={(conceptId) => {
          setEditConceptRequest(conceptId);
          handleModeChange('edit', 'graph');
        }}
        onRequestGraphSurface={() => setViewSurface('graph')}
        onRequestTreeSurface={() => setViewSurface('tree')}
        onSaved={(ontology) => {
          void queryClient.invalidateQueries({
            queryKey: [ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY],
          });
          refreshNativeWorkingDiff();
          selectOntology(ontology);
        }}
        onSelectedConceptChange={selectNativeConcept}
        onStatsChange={setNativeStats}
        onWorkingChange={refreshNativeWorkingDiff}
      />
    );
  };

  function renderAggregateError() {
    const alert = (
      <div
        className="tw:relative tw:min-h-70 tw:flex-1"
        data-testid="all-ontologies-load-error"
        role="alert">
        {allModels.isTooLarge ? (
          <NoDataPlaceholder
            description={t('message.ontology-aggregate-capacity')}
          />
        ) : (
          <SomethingWentWrongPlaceholder
            actions={[
              {
                key: 'reload',
                label: t('label.reload'),
                onPress: () => {
                  void studioScopes.refetchOntologies();
                  void allModels.refetch();
                },
              },
            ]}
          />
        )}
      </div>
    );

    if (!allModels.isTooLarge || !selectedConceptId) {
      return alert;
    }

    return (
      <div className="tw:flex tw:min-h-0 tw:flex-1">
        {alert}
        <AggregateConceptInspector
          conceptId={selectedConceptId}
          onClose={() => selectNativeConcept(undefined)}
          onEditConcept={(ontology, conceptId) =>
            selectOntology(ontology, conceptId, 'edit')
          }
          onOpenOwner={(ontology, conceptId) =>
            selectOntology(ontology, conceptId)
          }
          onSelectConcept={selectNativeConcept}
        />
      </div>
    );
  }

  function renderNoOntologies() {
    return (
      <OntologyEmptyState
        canCreate={canCreateOntology}
        onCreateFromScratch={() => setIsCreateDialogOpen(true)}
        onImportFile={() => setIsEmptyImportOpen(true)}
        onInstallFromLibrary={() => setIsLibraryOpen(true)}
      />
    );
  }

  function renderAllOntologies() {
    if (studioScopes.isOntologyLoading || allModels.isLoading) {
      return <Loader />;
    }
    if (studioScopes.isOntologyError || allModels.isError) {
      return renderAggregateError();
    }

    if (!allModels.graph) {
      return null;
    }

    const listSurface = aggregateSurface === 'tree' ? 'tree' : 'graph';

    return (
      <AllOntologiesGraphView
        graph={allModels.graph}
        isFetching={allModels.isFetching}
        models={allModels.models ?? []}
        selectedConceptId={selectedConceptId}
        surface={listSurface}
        onEditConcept={(ontology, conceptId) =>
          selectOntology(ontology, conceptId, 'edit')
        }
        onRefresh={() => {
          void studioScopes.refetchOntologies();
          void allModels.refetch();
        }}
        onRequestGraphSurface={() => setViewSurface('graph')}
        onSelectedConceptChange={(id) => {
          if (mode === 'edit' && id) {
            const owner = allModels.models?.find((model) =>
              model.concepts.some((concept) => concept.id === id)
            );
            if (owner) {
              selectOntology(owner.ontology, id, 'edit');

              return;
            }
          }
          selectNativeConcept(id);
        }}
      />
    );
  }

  const renderOwnerLoading = () => {
    if (ontologyNotFound) {
      return (
        <div
          className="tw:relative tw:min-h-70 tw:flex-1"
          data-testid="ontology-not-found"
          role="alert">
          <NoDataPlaceholder
            description={t('message.ontology-not-found')}
            footer={
              <Button
                color="secondary"
                onPress={() => handleScopeChange(ALL_ONTOLOGIES_SCOPE)}>
                {t('label.all-entity', {
                  entity: t('label.ontology-plural').toLocaleLowerCase(),
                })}
              </Button>
            }
            title={t('label.ontology')}
          />
        </div>
      );
    }

    return ontologyLoadFailed ? (
      <div className="tw:relative tw:min-h-70 tw:flex-1" role="alert">
        <SomethingWentWrongPlaceholder
          actions={[
            {
              key: 'reload',
              label: t('label.reload'),
              onPress: () => reloadOntology(),
            },
            {
              key: 'all-ontologies',
              label: t('label.all-entity', {
                entity: t('label.ontology-plural').toLocaleLowerCase(),
              }),
              color: 'secondary',
              onPress: () => handleScopeChange(ALL_ONTOLOGIES_SCOPE),
            },
          ]}
        />
      </div>
    ) : (
      <Loader />
    );
  };

  // The review banner floats over a graph canvas and sits above any other surface.
  const renderCanvasArea = (
    content: React.ReactNode,
    banner: React.ReactNode,
    isGraphCanvas: boolean
  ) => (
    <div className="tw:relative tw:flex tw:min-h-0 tw:flex-1 tw:flex-col">
      {banner ? (
        <div
          className={
            isGraphCanvas
              ? 'tw:pointer-events-none tw:absolute tw:inset-x-0 tw:top-3 tw:z-20 tw:flex tw:justify-center tw:px-4 tw:*:pointer-events-auto'
              : 'tw:flex tw:shrink-0 tw:justify-center tw:px-4 tw:pt-3'
          }>
          {banner}
        </div>
      ) : null}
      {content}
      {renderCanvasToolbar()}
    </div>
  );

  const renderAggregateCreateDrawer = () =>
    mode === 'edit' && isAggregateCreateOpen ? (
      <OntologyAllOntologiesConceptDrawer
        ontologies={availableOntologies}
        onClose={() => guard(() => setIsAggregateCreateOpen(false))}
        onCreated={(_ontology, done) => {
          void studioScopes.refetchOntologies();
          refreshNativeWorkingDiff();
          void allModels.refetch();
          if (done) {
            setIsAggregateCreateOpen(false);
          }
        }}
      />
    ) : null;

  const renderAggregateWorkspace = (
    tasksAction: React.ReactNode,
    banner: React.ReactNode
  ) => (
    <>
      {renderSubModeNav(tasksAction)}
      {mode === 'query' ? (
        <OntologyQueryPicker
          isOpen={isQueryPickerOpen}
          ontologies={availableOntologies}
          surface={querySurface}
          onOpenChange={setIsQueryPickerOpen}
          onSelect={(ontology) => selectOntology(ontology, undefined, mode)}
        />
      ) : null}
      {mode !== 'query' && aggregateSurface === 'ontology'
        ? renderCanvasArea(
            <div className="tw:flex tw:min-h-0 tw:flex-1">
              <div className="tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-col">
                <OntologyQueryPicker
                  ontologies={availableOntologies}
                  surface="ontology"
                  onSelect={(ontology) =>
                    selectOntology(ontology, undefined, mode, 'ontology')
                  }
                />
              </div>
              {renderAggregateCreateDrawer()}
            </div>,
            banner,
            false
          )
        : null}
      {mode === 'query' || aggregateSurface === 'ontology'
        ? null
        : renderCanvasArea(
            <div className="tw:flex tw:min-h-0 tw:flex-1">
              <div className="tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-col">
                {renderAllOntologies()}
              </div>
              {renderAggregateCreateDrawer()}
            </div>,
            banner,
            aggregateSurface === 'graph'
          )}
    </>
  );

  const renderWorkspace = (
    tasksAction: React.ReactNode,
    banner: React.ReactNode
  ) => {
    if (ontologyId && !selectedOntology) {
      return renderOwnerLoading();
    }

    if (isCatalogEmpty) {
      return renderNoOntologies();
    }

    if (isAllOntologies) {
      return renderAggregateWorkspace(tasksAction, banner);
    }

    if (selectedOntology) {
      return (
        <>
          {renderSubModeNav(tasksAction)}
          {renderCanvasArea(
            <section className="tw:flex tw:min-h-0 tw:flex-1 tw:bg-primary">
              {renderNativeContent(selectedOntology)}
            </section>,
            banner,
            isNativeGraphCanvas(mode, explorerSurface, editSurface)
          )}
        </>
      );
    }

    return (
      <>
        {renderSubModeNav(tasksAction)}
        {renderCanvasArea(
          renderMainSection(),
          banner,
          [
            isGlossaryScope,
            showDefaultSurface,
            explorerSurface === 'graph',
          ].every(Boolean)
        )}
      </>
    );
  };

  function renderPublicationModal() {
    if (selectedReviewTaskId || !isPublicationOpen) {
      return null;
    }
    if (selectedOntology) {
      return (
        <OntologyPublicationModal
          canEdit={canEditNativeOntology}
          initialTab={publicationTab}
          key={String(userId) + selectedOntology.id}
          ontology={selectedOntology}
          onClose={() => setIsPublicationOpen(false)}
          onOpenTask={selectReviewTask}
        />
      );
    }

    return null;
  }

  const renderLibrary = () => {
    if (!isLibraryOpen) {
      return null;
    }
    if (isGlossaryScope) {
      return (
        <OntologyLibrary
          canInstall={Boolean(isAdminUser)}
          onClose={() => setIsLibraryOpen(false)}
          onOpenGlossary={handleOpenGlossary}
        />
      );
    }

    return (
      <OntologyLibrary
        native={{
          ontologies: availableOntologies,
          initialOntology:
            selectedOntology ??
            allModels.models?.find((model) =>
              model.concepts.some((concept) => concept.id === selectedConceptId)
            )?.ontology,
          canCreate: canCreateOntology,
          onCreated: () => {
            void queryClient.invalidateQueries({
              queryKey: [ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY],
            });
          },
          onOpenOntology: (ontology) => {
            guard(() => {
              selectOntology(ontology);
              setIsLibraryOpen(false);
            });
          },
          onApplied: (ontology) => {
            void queryClient.invalidateQueries({
              queryKey: [ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY],
            });
            void queryClient.invalidateQueries({
              queryKey: [ONTOLOGY_STUDIO_MODEL_QUERY_KEY],
            });
            void queryClient.invalidateQueries({
              queryKey: [ONTOLOGY_WORKING_DIFF_QUERY_KEY, ontology.id],
            });
            void queryClient.invalidateQueries({
              queryKey: ['ontology-state', ontology.id],
            });
          },
        }}
        onClose={() => setIsLibraryOpen(false)}
      />
    );
  };

  const handleOntologyCreated = (ontology: Ontology) => {
    setIsCreateDialogOpen(false);
    setPendingFirstClass({ ontologyId: ontology.id, isUrlReached: false });
    void queryClient.invalidateQueries({
      queryKey: [ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY],
    });
    selectOntology(ontology, undefined, 'edit');
    showSuccessToast(
      t('message.ontology-created-add-first-class', {
        name: getEntityName(ontology),
      })
    );
  };

  const renderOverlays = () => (
    <>
      {renderLibrary()}
      {renderPublicationModal()}
      {isCreateDialogOpen ? (
        <OntologyCreateDialog
          ontologies={
            studioScopes.isOntologyLoading || studioScopes.isOntologyError
              ? undefined
              : availableOntologies
          }
          onClose={() => setIsCreateDialogOpen(false)}
          onCreated={handleOntologyCreated}
        />
      ) : null}
      {settingsOntology ? (
        <OntologySettingsDialog
          ontology={settingsOntology}
          onClose={() => guard(() => setSettingsOntology(undefined))}
          onSaved={(saved) => {
            setSettingsOntology(undefined);
            void queryClient.invalidateQueries({
              queryKey: [ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY],
            });
            refreshNativeWorkingDiff();
            if (saved.id === selectedOntology?.id) {
              reloadOntology();
            }
          }}
        />
      ) : null}
      {isEmptyImportOpen ? (
        <OntologyNativeImportDialog
          onClose={() => setIsEmptyImportOpen(false)}
        />
      ) : null}
    </>
  );

  return (
    <PageLayoutV1
      fullHeight
      className={classNames('tw:p-0!', {
        'tw:h-full!': isAiMode,
      })}
      mainContainerClassName={classNames('ontology-studio-page-layout', {
        'tw:h-full!': isAiMode,
      })}
      pageTitle={t('label.ontology-studio')}>
      <main
        className={getShellClassName(isFullScreen)}
        data-testid="ontology-studio-shell"
        ref={setDrawerHost}
        style={ONTOLOGY_STUDIO_STYLE}>
        <OntologyTasksDrawer
          ontologyId={selectedOntology?.id}
          taskId={selectedReviewTaskId}
          onTaskChange={selectReviewTask}>
          {({ tasksAction, banner }) => (
            <>
              {renderHeader(tasksAction)}
              {/* The AI header is an inset card; the workspace below takes the
                  same inset and card frame so their edges line up. */}
              <div
                className={classNames(
                  'tw:flex tw:min-h-0 tw:flex-1 tw:flex-col',
                  isAiMode &&
                    'tw:mx-2 tw:mb-2 tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary'
                )}>
                <OntologyGraphSearchSlotContext.Provider value={searchSlot}>
                  <OntologyStudioDrawerHostContext.Provider value={drawerHost}>
                    {renderWorkspace(tasksAction, banner)}
                  </OntologyStudioDrawerHostContext.Provider>
                </OntologyGraphSearchSlotContext.Provider>
              </div>
              {renderOverlays()}
            </>
          )}
        </OntologyTasksDrawer>
      </main>
    </PageLayoutV1>
  );
};

const OntologyExplorerPage: React.FC = () => (
  <OntologyDraftProvider>
    <OntologyExplorerContent />
  </OntologyDraftProvider>
);

export default OntologyExplorerPage;
