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
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowRight,
  GitBranch01,
  Grid01,
  Plus,
  Share07,
} from '@openmetadata/ui-core-components/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import NoDataPlaceholder from '../../components/common/EmptyPlaceholder/NoDataPlaceholder';
import HeaderBreadcrumb from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import { getGlossaryHomeCrumb } from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.utils';
import AllOntologiesGraphView from '../../components/governance/ontology/AllOntologiesGraphView/AllOntologiesGraphView';
import { OntologyModelStats } from '../../components/governance/ontology/OntologyGraphView/OntologyGraphView';
import OntologyPublicationModal from '../../components/governance/ontology/OntologyPublicationModal/OntologyPublicationModal';
import OntologyStudioHeader from '../../components/governance/ontology/OntologyStudioHeader/OntologyStudioHeader';
import OntologyStudioScopeMenu from '../../components/governance/ontology/OntologyStudioScopeMenu/OntologyStudioScopeMenu';
import OntologyStudioSubBar from '../../components/governance/ontology/OntologyStudioSubBar/OntologyStudioSubBar';
import OntologyStudioWorkspace from '../../components/governance/ontology/OntologyStudioWorkspace/OntologyStudioWorkspace';
import { useOntologyAiCapability } from '../../components/OntologyExplorer/hooks/useOntologyAiCapability';
import OntologyAiAssistant from '../../components/OntologyExplorer/OntologyAiAssistant';
import OntologyEditLeaseStatus from '../../components/OntologyExplorer/OntologyEditLeaseStatus';
import OntologyExplorer from '../../components/OntologyExplorer/OntologyExplorer';
import { OntologyGraphData } from '../../components/OntologyExplorer/OntologyExplorer.interface';
import OntologyImportExportMenu from '../../components/OntologyExplorer/OntologyImportExportMenu';
import OntologyLibrary from '../../components/OntologyExplorer/OntologyLibrary';
import OntologyMemoryReviewPanel from '../../components/OntologyExplorer/OntologyMemoryReviewPanel';
import { ONTOLOGY_STUDIO_STYLE } from '../../components/OntologyExplorer/OntologyStudio.styles';
import OntologyStudioQueryConsole from '../../components/OntologyExplorer/OntologyStudioQueryConsole';
import OntologyVisualQueryBuilder from '../../components/OntologyExplorer/OntologyVisualQueryBuilder';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { UIPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { ResourceEntity } from '../../enums/permissions.enum';
import { Glossary } from '../../generated/entity/data/glossary';
import { Ontology } from '../../generated/entity/data/ontology';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { Operation } from '../../generated/entity/policies/policy';
import { useAuth } from '../../hooks/authHooks';
import {
  OntologyEditLeaseState,
  useOntologyEditLease,
} from '../../hooks/governance/ontology/useOntologyEditLease';
import {
  ONTOLOGY_STUDIO_MODEL_QUERY_KEY,
  useAllOntologyStudioModels,
} from '../../hooks/governance/ontology/useOntologyStudioModel';
import {
  ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY,
  useOntologyStudioScopes,
} from '../../hooks/governance/ontology/useOntologyStudioScopes';
import { useIsAiMode } from '../../hooks/useAppMode';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
import { getOntology, getOntologyWorkingDiff } from '../../rest/ontologyAPI';
import { getEntityName } from '../../utils/EntityNameUtils';
import {
  ALL_ONTOLOGIES_SCOPE,
  getScopeKey,
  getStudioScope,
  isOntologyScope,
  OntologyStudioScope,
} from '../../utils/governance/ontology/OntologyStudioScope.utils';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import {
  checkPermission,
  DEFAULT_ENTITY_PERMISSION,
} from '../../utils/PermissionsUtils';
import { generateUUID } from '../../utils/StringUtils';
import { showErrorToast, showInfoToast } from '../../utils/ToastUtils';

// 'review' has no tab; a memory's "view draft" link (?draft=) still opens it.
type StudioMode = 'view' | 'edit' | 'query' | 'ai' | 'review';
type ViewSurface = 'graph' | 'tree';
type QuerySurface = 'console' | 'builder';

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

const ONTOLOGY_WORKING_DIFF_QUERY_KEY = 'ontology-working-diff';

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
        className="tw:font-body tw:text-base tw:font-semibold tw:text-primary">
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

function computeCanEditOntology(
  isAdminUser: boolean | undefined,
  permissions: UIPermission
): boolean {
  return (
    Boolean(isAdminUser) ||
    checkPermission(Operation.EditAll, ResourceEntity.GLOSSARY, permissions) ||
    checkPermission(
      Operation.EditGlossaryTerms,
      ResourceEntity.GLOSSARY,
      permissions
    ) ||
    checkPermission(
      Operation.EditEntityRelationship,
      ResourceEntity.GLOSSARY_TERM,
      permissions
    )
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
  const canSubmit =
    canApply ||
    checkPermission(
      Operation.EditGlossaryTerms,
      ResourceEntity.GLOSSARY,
      permissions
    );
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

function getViewSubModeConfiguration(
  viewSurface: ViewSurface,
  t: TFunction
): StudioSubMode {
  return {
    id: viewSurface,
    items: [
      { id: 'graph', label: t('label.graph') },
      { id: 'tree', label: t('label.tree') },
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
    editSurface: 'graph' | 'definitions';
    viewSurface: ViewSurface;
    querySurface: QuerySurface;
  },
  isRdfEnabled: boolean,
  isNativeOntology: boolean,
  t: TFunction
): StudioSubMode {
  const configByMode: Record<StudioMode, () => StudioSubMode> = {
    ai: () => ({ id: 'ai', items: [] }),
    edit: () => ({
      id: isNativeOntology ? surfaces.editSurface : 'graph',
      items: [
        { id: 'graph', label: t('label.graph') },
        ...(isNativeOntology
          ? [{ id: 'definitions', label: t('label.term') }]
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
    view: () => getViewSubModeConfiguration(surfaces.viewSurface, t),
  };

  return configByMode[mode]();
}

function resolveViewSurfaceChange(id: string): ViewSurface | undefined {
  return id === 'graph' || id === 'tree' ? (id as ViewSurface) : undefined;
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
  isCreatingOntology: boolean,
  selectedOntology: Ontology | undefined,
  selectedGlossary: Glossary | undefined,
  allGlossariesLabel: string,
  t: TFunction
): string {
  if (isCreatingOntology) {
    return t('label.new-entity', { entity: t('label.ontology') });
  }
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
    return `${aggregateGraph?.nodes.length ?? 0} ${t(
      'label.concept-plural'
    ).toLocaleLowerCase()} · ${aggregateGraph?.edges.length ?? 0} ${t(
      'label.relation-plural'
    ).toLocaleLowerCase()}`;
  }
  if (scope.kind === 'ontology') {
    const currentStats =
      nativeStats?.ontologyId === ontologyId ? nativeStats : undefined;

    if (!currentStats) {
      return '';
    }

    return `${currentStats.conceptCount} ${t(
      'label.concept-plural'
    ).toLocaleLowerCase()} · ${currentStats.relationCount} ${t(
      'label.relation-plural'
    ).toLocaleLowerCase()}`;
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

function aggregateEnabled(
  isAllOntologies: boolean,
  isCreatingOntology: boolean,
  scopes: ReturnType<typeof useOntologyStudioScopes>
): boolean {
  return (
    isAllOntologies &&
    !isCreatingOntology &&
    !scopes.isOntologyLoading &&
    !scopes.isOntologyError
  );
}

const OntologyExplorerPage: React.FC = () => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const { isAdminUser } = useAuth();
  const { permissions } = usePermissionProvider();
  const queryClient = useQueryClient();
  const {
    isEnabled: isOntologyAiEnabled,
    isRdfEnabled,
    isLoading: isCapabilityLoading,
  } = useOntologyAiCapability();
  const initialDraftId = useLinkedDraftId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadedOntology, setLoadedOntology] = useState<Ontology>();
  const [isCreatingOntology, setIsCreatingOntology] = useState(false);
  const [isGlossaryScopeMenuOpen, setIsGlossaryScopeMenuOpen] = useState(false);
  const [mode, setMode] = useState<StudioMode>(() =>
    studioModeFor(initialDraftId)
  );
  const studioScope = getStudioScope(searchParams);
  const isAllOntologies = studioScope.kind === 'allOntologies';
  const isGlossaryScope = studioScope.kind === 'glossaries';
  const ontologyId = searchParams.get('ontology');
  const selectedConceptId = searchParams.get('concept') ?? undefined;
  const requestedNativeMode = useRef<StudioMode>();
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
  const [ontologyLoadFailed, setOntologyLoadFailed] = useState(false);
  const [ontologyLoadAttempt, setOntologyLoadAttempt] = useState(0);
  const selectedOntology = getSelectedOntology(ontologyId, loadedOntology);
  const canCreateOntology = canCreateNativeOntology(isAdminUser, permissions);
  const selectedOntologyId = selectedOntology?.id ?? '';
  const refreshNativeWorkingDiff = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [ONTOLOGY_STUDIO_MODEL_QUERY_KEY],
    });
    if (selectedOntologyId) {
      void queryClient.invalidateQueries({
        queryKey: [ONTOLOGY_WORKING_DIFF_QUERY_KEY, selectedOntologyId],
      });
    }
  }, [queryClient, selectedOntologyId]);
  const workingDiff = useQuery({
    queryKey: [ONTOLOGY_WORKING_DIFF_QUERY_KEY, selectedOntologyId, undefined],
    enabled: Boolean(selectedOntologyId),
    queryFn: ({ signal }) =>
      getOntologyWorkingDiff(selectedOntologyId, { limit: 25 }, signal),
    retry: false,
  });
  const { canEditAll: canEditNativeOntology } = useEntityPermissions(
    ResourceEntity.ONTOLOGY,
    { id: selectedOntologyId },
    { enabled: Boolean(selectedOntology), deleted: selectedOntology?.deleted }
  );
  const { canCreate: canCreateNativeConcept } = getDerivedPermissionFlags(
    permissions[ResourceEntity.ONTOLOGY_CONCEPT] ?? DEFAULT_ENTITY_PERMISSION,
    selectedOntology?.deleted
  );
  const [publicationScopeKey, setPublicationScopeKey] = useState<string>();
  const currentScopeKey = getScopeKey(studioScope);
  const isPublicationOpen = publicationScopeKey === currentScopeKey;
  const setIsPublicationOpen = (open: boolean) =>
    setPublicationScopeKey(open ? currentScopeKey : undefined);
  useEffect(() => {
    setPublicationScopeKey((key) =>
      key === currentScopeKey ? key : undefined
    );
  }, [currentScopeKey]);

  useEffect(() => {
    if (!ontologyId) {
      return;
    }
    if (loadedOntology?.id === ontologyId) {
      return;
    }
    const controller = new AbortController();
    setOntologyLoadFailed(false);
    getOntology(ontologyId, 'owners,reviewers', controller.signal)
      .then((ontology) => {
        if (!controller.signal.aborted) {
          setLoadedOntology(ontology);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          showErrorToast(error);
          setLoadedOntology(undefined);
          setOntologyLoadFailed(true);
        }
      });

    return () => controller.abort();
  }, [loadedOntology?.id, ontologyId, ontologyLoadAttempt]);

  useEffect(() => {
    setMode(requestedNativeMode.current ?? studioModeFor(initialDraftId));
    requestedNativeMode.current = undefined;
  }, [initialDraftId, ontologyId]);
  const [viewSurface, setViewSurface] = useState<ViewSurface>('graph');
  const [editSurface, setEditSurface] = useState<'graph' | 'definitions'>(
    'graph'
  );
  const [querySurface, setQuerySurface] = useState<QuerySurface>('console');
  const [stats, setStats] = useState<string[]>([]);
  const [glossaries, setGlossaries] = useState<Glossary[]>([]);
  const [graphData, setGraphData] = useState<OntologyGraphData | null>(null);
  const [relationTypes, setRelationTypes] = useState<RelationshipType[]>([]);
  const [authoringGlossaryId, setAuthoringGlossaryId] = useState<string>();
  const [pendingGlossaryName, setPendingGlossaryName] = useState<string>();
  const [explorerRevision, setExplorerRevision] = useState(0);
  const [generatedQuery, setGeneratedQuery] = useState<string>();
  const [queryConsoleKey, setQueryConsoleKey] = useState(0);
  const [isNewQueryRequested, setIsNewQueryRequested] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [nativeStats, setNativeStats] = useState<OntologyModelStats>();
  const [nativeRefresh, setNativeRefresh] = useState(0);
  const [nativeConceptRequest, setNativeConceptRequest] = useState<{
    key: number;
    ontologyId: string;
  }>();
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
  const availableOntologies = useMemo(
    () => mergeSelectedOntology(studioScopes.ontologies, selectedOntology),
    [selectedOntology, studioScopes.ontologies]
  );

  const allModels = useAllOntologyStudioModels(
    studioScopes.ontologies,
    aggregateEnabled(isAllOntologies, isCreatingOntology, studioScopes)
  );

  const selectOntology = (
    ontology?: Ontology,
    conceptId?: string,
    nextMode: StudioMode = 'view'
  ) => {
    setIsPublicationOpen(false);
    setLoadedOntology(undefined);
    setOntologyLoadAttempt((attempt) => attempt + 1);
    setIsCreatingOntology(false);
    requestedNativeMode.current = nextMode;
    setMode(nextMode);
    const cachedModel = allModels.models?.find(
      (model) => model.ontology.id === ontology?.id
    );
    if (
      cachedModel &&
      !allModels.isFetching &&
      !queryClient.getQueryState([
        ONTOLOGY_STUDIO_MODEL_QUERY_KEY,
        'all',
        studioScopes.ontologies.map(({ id }) => id),
      ])?.isInvalidated
    ) {
      queryClient.setQueryData(
        [ONTOLOGY_STUDIO_MODEL_QUERY_KEY, ontology?.id],
        cachedModel
      );
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
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

      return next;
    });
  };
  const handleStatsChange = useCallback((newStats: string[]) => {
    setStats(newStats);
  }, []);

  const handleGlossariesChange = useCallback((items: Glossary[]) => {
    setGlossaries(items);
  }, []);

  const handleOpenGlossary = useCallback((glossaryName: string) => {
    setPendingGlossaryName(glossaryName);
    setIsLibraryOpen(false);
    setMode('view');
    setViewSurface('graph');
    setExplorerRevision((revision) => revision + 1);
  }, []);

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
  const scopeLabel = getStudioScopeLabel(
    studioScope,
    isCreatingOntology,
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
    return (
      isGlossaryScope &&
      !isCreatingOntology &&
      mode === 'edit' &&
      Boolean(leaseGlossary)
    );
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

  const explorerSurface: ViewSurface = mode === 'view' ? viewSurface : 'graph';

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
  const isOntologyAiAvailable = isGlossaryScope && isOntologyAiEnabled;
  const modeTabs = computeModeTabs(
    t,
    canEditCurrentScope,
    isOntologyAiAvailable
  );

  useEffect(() => {
    if (ontologyId && !selectedOntology) {
      return;
    }
    const isUnavailableEditMode = mode === 'edit' && !canEditCurrentScope;
    const isUnavailableAiMode =
      mode === 'ai' && (isNativeOntology || !isOntologyAiEnabled);
    if (isUnavailableEditMode || isUnavailableAiMode) {
      setMode('view');
    }
  }, [
    canEditCurrentScope,
    isNativeOntology,
    isOntologyAiEnabled,
    mode,
    ontologyId,
    selectedOntology,
  ]);

  const subModeConfiguration = getSubModeConfiguration(
    mode,
    { editSurface, querySurface, viewSurface },
    isRdfEnabled,
    isNativeOntology,
    t
  );

  const handleSubModeChange = useCallback(
    (id: string) => {
      if (mode === 'edit' && (id === 'graph' || id === 'definitions')) {
        setEditSurface(id);
      }
      if (mode === 'view') {
        const nextViewSurface = resolveViewSurfaceChange(id);
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
    [mode]
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
      surface={explorerSurface}
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
    setIsPublicationOpen(false);
    setIsLibraryOpen(false);
    if (nextScope.kind === 'allOntologies') {
      setLoadedOntology(undefined);
      setIsCreatingOntology(false);
      setMode('view');
      setConceptDraft(undefined);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('ontology');
        next.delete('scope');
        next.delete(DRAFT_SEARCH_PARAM);
        next.delete('concept');

        return next;
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
    setIsCreatingOntology(false);
    if (scopeChanged) {
      setConceptDraft(undefined);
    }
    if (domainChanged) {
      setMode('view');
      setViewSurface('graph');
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('ontology');
      next.delete('concept');
      next.set('scope', getScopeKey(nextScope));
      if (scopeChanged) {
        next.delete(DRAFT_SEARCH_PARAM);
      }

      return next;
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
        scope={isCreatingOntology ? ALL_ONTOLOGIES_SCOPE : studioScope}
        onCreateOntology={
          canCreateOntology
            ? () => {
                selectOntology(undefined);
                setIsCreatingOntology(true);
              }
            : undefined
        }
        onOpenChange={(open) =>
          setIsGlossaryScopeMenuOpen(open && isGlossaryScope)
        }
        onRetry={() =>
          void (isGlossaryScope
            ? studioScopes.refetch()
            : studioScopes.refetchOntologies())
        }
        onScopeChange={handleScopeChange}
      />
    );
  }

  function handleModeChange(nextMode: StudioMode) {
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
    setMode(nextMode);
  }

  function handleAddConcept() {
    if (isNativeOntology) {
      setNativeConceptRequest((current) => ({
        key: current?.ontologyId === ontologyId ? current.key + 1 : 1,
        ontologyId: ontologyId ?? '',
      }));

      return;
    }

    const defaultGlossaryId = graphLeaseGlossary?.id;
    setAuthoringGlossaryId(defaultGlossaryId);
    setConceptDraft({
      defaultGlossaryId,
      id: `ontology-concept-draft-${generateUUID()}`,
    });
  }

  const canAddConcept = isNativeOntology
    ? canCreateNativeConcept && editSurface === 'graph'
    : canCreateConcept;

  function renderPrimaryAction() {
    if (mode === 'view' && canEditCurrentScope && !isAllOntologies) {
      return (
        <Button
          color="primary"
          data-testid="ontology-edit-ontology"
          iconTrailing={ArrowRight}
          size="xs"
          onPress={() => handleModeChange('edit')}>
          {t('label.edit-entity', { entity: t('label.ontology') })}
        </Button>
      );
    }

    if (mode === 'edit' && canAddConcept) {
      return (
        <Button
          color="primary"
          data-testid="ontology-add-concept"
          iconLeading={Plus}
          isDisabled={!isNativeOntology && Boolean(conceptDraft)}
          size="xs"
          onPress={handleAddConcept}>
          {t('label.add-entity', { entity: t('label.concept') })}
        </Button>
      );
    }

    if (mode === 'query' && (isNativeOntology || isRdfEnabled)) {
      return (
        <Button
          color="primary"
          data-testid="ontology-new-query"
          iconLeading={Plus}
          size="xs"
          onPress={() => {
            setGeneratedQuery(undefined);
            setIsNewQueryRequested(true);
            setQuerySurface('console');
            setQueryConsoleKey((key) => key + 1);
          }}>
          {t('label.new-entity', { entity: t('label.query') })}
        </Button>
      );
    }

    return null;
  }

  function renderPublicationActions() {
    if ((!selectedOntology && !isAllOntologies) || isCreatingOntology) {
      return null;
    }
    const isolatedCount = getIsolatedCount(nativeStats, selectedOntology);

    return (
      <>
        <Button
          color="primary"
          data-testid="ontology-publication-trigger"
          iconLeading={GitBranch01}
          isDisabled={
            isAllOntologies &&
            (studioScopes.isOntologyLoading || studioScopes.isOntologyError)
          }
          size="xs"
          onPress={() => setIsPublicationOpen(true)}>
          {t(selectedOntology ? 'label.publish' : 'label.review-publish')}
          {selectedOntology && workingDiff.data
            ? ` (${workingDiff.data.paging.total})`
            : ''}
        </Button>
        {isolatedCount > 0 && (
          <BadgeWithDot color="warning" size="sm">
            {isolatedCount} {t('label.isolated')}
          </BadgeWithDot>
        )}
      </>
    );
  }

  function renderHeader() {
    return (
      <OntologyStudioHeader
        actions={
          <Box align="center" gap={2} wrap="wrap">
            {!isCreatingOntology && (
              <Button
                aria-haspopup="dialog"
                aria-label={t('label.library')}
                color="secondary"
                data-testid="ontology-library-trigger"
                iconLeading={<Grid01 className="tw:text-fg-brand-primary" />}
                size="sm"
                tooltip={t('label.library')}
                tooltipPlacement="bottom"
                onPress={() => setIsLibraryOpen(true)}
              />
            )}
            {!isCreatingOntology && isNativeOntology && selectedOntology ? (
              <OntologyImportExportMenu
                canImport={canEditNativeOntology}
                key={selectedOntology.id}
                kind="ontology"
                ontology={selectedOntology}
                onApplied={() => {
                  setNativeStats(undefined);
                  setNativeRefresh((value) => value + 1);
                  refreshNativeWorkingDiff();
                }}
              />
            ) : null}
            {!isCreatingOntology && isGlossaryScope ? (
              <OntologyImportExportMenu
                glossaries={glossaries}
                glossary={selectedGlossary}
                isAdminUser={Boolean(isAdminUser)}
                kind="glossary"
                relationCount={relationCount}
                termCount={termCount}
              />
            ) : null}
            {!isCreatingOntology ? renderPrimaryAction() : null}
            {renderPublicationActions()}
          </Box>
        }
        breadcrumb={
          isAiMode ? (
            <HeaderBreadcrumb
              noMargin
              items={[
                getGlossaryHomeCrumb(t),
                { label: t('label.ontology-studio') },
              ]}
              showHome={false}
            />
          ) : undefined
        }
        mode={mode}
        modes={modeTabs}
        scopeMenu={renderScopeMenu()}
        onModeChange={handleModeChange}
      />
    );
  }

  function renderSubModeNav() {
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
              size="text-xs">
              {statsLabel}
            </Typography>
          </Box>
        }
        onSurfaceChange={handleSubModeChange}>
        {isGlossaryScope && showDefaultSurface ? (
          <div
            className="tw:min-w-35 tw:max-w-70 tw:flex-1 tw:border-l tw:border-secondary tw:pl-3 tw:empty:hidden"
            ref={setSearchSlot}
          />
        ) : null}
      </OntologyStudioSubBar>
    );
  }

  function renderQuerySurface() {
    return (
      <div className="tw:min-h-0 tw:min-w-0 tw:flex-1 tw:overflow-auto">
        {querySurface === 'console' ? (
          <OntologyStudioQueryConsole
            createQueryOnMount={isNewQueryRequested}
            graphData={isNativeOntology ? null : graphData}
            initialQuery={generatedQuery}
            key={queryConsoleKey}
            relationTypes={isNativeOntology ? [] : relationTypes}
            selectedGlossaryIds={isNativeOntology ? [] : selectedGlossaryIds}
            selectedOntologyId={selectedOntology?.id}
            onQueryCreated={() => setIsNewQueryRequested(false)}
          />
        ) : (
          <OntologyVisualQueryBuilder
            graphData={isNativeOntology ? undefined : graphData}
            ontology={isNativeOntology ? selectedOntology : undefined}
            relationTypes={relationTypes}
            selectedGlossaryIds={selectedGlossaryIds}
            onEditAsSparql={(query) => {
              setGeneratedQuery(query);
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
            setGeneratedQuery(query);
            setQuerySurface('console');
            setMode('query');
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

  const renderNativeContent = () => {
    if (mode === 'query' || mode === 'ai') {
      return renderMainContent();
    }

    return (
      <OntologyStudioWorkspace
        canCreate={canCreateOntology}
        createConceptRequestKey={
          nativeConceptRequest?.ontologyId === selectedOntology?.id
            ? nativeConceptRequest?.key
            : 0
        }
        initialDraftId={initialDraftId}
        key={`${selectedOntology?.id ?? 'new'}:${nativeRefresh}`}
        mode={
          mode === 'edit' && editSurface === 'definitions'
            ? 'definitions'
            : mode
        }
        ontology={selectedOntology}
        selectedConceptId={selectedConceptId}
        viewSurface={explorerSurface}
        onRequestEdit={() => {
          setEditSurface('graph');
          handleModeChange('edit');
        }}
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
    return (
      <Box
        className="tw:p-6"
        data-testid="all-ontologies-load-error"
        direction="col"
        gap={3}>
        <Typography role="alert">
          {t(
            allModels.isTooLarge
              ? 'message.ontology-aggregate-capacity'
              : 'message.temporary-error-try-reloading'
          )}
        </Typography>
        {!allModels.isTooLarge ? (
          <Button
            color="secondary"
            onPress={() => {
              void studioScopes.refetchOntologies();
              void allModels.refetch();
            }}>
            {t('label.retry')}
          </Button>
        ) : null}
        {availableOntologies.map((ontology) => (
          <Button
            color="secondary"
            key={ontology.id}
            onPress={() => selectOntology(ontology)}>
            {getEntityName(ontology)}
          </Button>
        ))}
      </Box>
    );
  }

  function renderAllOntologies() {
    if (studioScopes.isOntologyLoading || allModels.isLoading) {
      return <Typography role="status">{t('label.loading')}</Typography>;
    }
    if (studioScopes.isOntologyError || allModels.isError) {
      return renderAggregateError();
    }

    if (availableOntologies.length === 0) {
      return (
        <div
          className="tw:relative tw:h-full tw:min-h-70"
          data-testid="all-ontologies-empty">
          <NoDataPlaceholder
            actions={
              canCreateOntology
                ? [
                    {
                      key: 'new-ontology',
                      label: t('label.new-entity', {
                        entity: t('label.ontology'),
                      }),
                      iconLeading: Plus,
                      onPress: () => setIsCreatingOntology(true),
                    },
                  ]
                : undefined
            }
            icon={<Share07 className="tw:text-fg-brand-primary" />}
            title={t('label.no-entity', { entity: t('label.ontology-plural') })}
          />
        </div>
      );
    }
    if (!allModels.graph) {
      return null;
    }

    return (
      <AllOntologiesGraphView
        graph={allModels.graph}
        isFetching={allModels.isFetching}
        models={allModels.models ?? []}
        selectedConceptId={selectedConceptId}
        surface={viewSurface}
        onEditConcept={(ontology, conceptId) =>
          selectOntology(ontology, conceptId, 'edit')
        }
        onRefresh={() => {
          void studioScopes.refetchOntologies();
          void allModels.refetch();
        }}
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
    return ontologyLoadFailed ? (
      <Box className="tw:p-6" direction="col" gap={3}>
        <Typography role="alert">
          {t('message.temporary-error-try-reloading')}
        </Typography>
        <Button
          color="secondary"
          onPress={() => setOntologyLoadAttempt((attempt) => attempt + 1)}>
          {t('label.retry')}
        </Button>
        <Button
          color="secondary"
          onPress={() => handleScopeChange(ALL_ONTOLOGIES_SCOPE)}>
          {t('label.all-entity', {
            entity: t('label.ontology-plural').toLocaleLowerCase(),
          })}
        </Button>
      </Box>
    ) : (
      <Typography role="status">{t('label.loading')}</Typography>
    );
  };

  const renderAggregateWorkspace = () => (
    <>
      {renderSubModeNav()}
      {mode === 'edit' || mode === 'query' ? (
        <Box className="tw:p-4" direction="col" gap={3}>
          <Select
            className="tw:w-75"
            items={availableOntologies.map((ontology) => ({
              id: ontology.id,
              label: getEntityName(ontology),
            }))}
            label={t('label.select-entity', {
              entity: t('label.ontology'),
            })}
            onChange={(id) => {
              const ontology = availableOntologies.find(
                (item) => item.id === id
              );
              if (ontology) {
                selectOntology(ontology, undefined, mode);
              }
            }}>
            {(item) => (
              <Select.Item id={item.id} key={item.id} label={item.label} />
            )}
          </Select>
        </Box>
      ) : null}
      {mode !== 'query' ? renderAllOntologies() : null}
    </>
  );

  const renderWorkspace = () => {
    if (ontologyId && !selectedOntology) {
      return renderOwnerLoading();
    }

    if (isAllOntologies && !isCreatingOntology) {
      return renderAggregateWorkspace();
    }

    if (selectedOntology || isCreatingOntology) {
      return (
        <>
          {!isCreatingOntology ? renderSubModeNav() : null}
          <section className="tw:flex tw:min-h-0 tw:flex-1 tw:bg-primary">
            {renderNativeContent()}
          </section>
        </>
      );
    }

    return (
      <>
        {renderSubModeNav()}
        {renderMainSection()}
      </>
    );
  };

  function renderPublicationModal() {
    if (!isPublicationOpen) {
      return null;
    }
    if (selectedOntology) {
      return (
        <OntologyPublicationModal
          canEdit={canEditNativeOntology}
          key={selectedOntology.id}
          ontology={selectedOntology}
          onClose={() => setIsPublicationOpen(false)}
        />
      );
    }
    if (!isAllOntologies) {
      return null;
    }

    return (
      <OntologyPublicationModal
        canEdit={false}
        initialOntology={
          allModels.models?.find((model) =>
            model.concepts.some((concept) => concept.id === selectedConceptId)
          )?.ontology
        }
        ontologies={availableOntologies}
        onClose={() => setIsPublicationOpen(false)}
      />
    );
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
            selectOntology(ontology);
            setViewSurface('graph');
            setIsLibraryOpen(false);
          },
          onApplied: (ontology) => {
            void queryClient.invalidateQueries({
              queryKey: [ONTOLOGY_STUDIO_MODEL_QUERY_KEY],
            });
            void queryClient.invalidateQueries({
              queryKey: [ONTOLOGY_WORKING_DIFF_QUERY_KEY, ontology.id],
            });
          },
        }}
        onClose={() => setIsLibraryOpen(false)}
      />
    );
  };

  const renderOverlays = () => (
    <>
      {renderLibrary()}
      {renderPublicationModal()}
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
        className="tw:relative tw:flex tw:h-full tw:min-h-0 tw:flex-col tw:overflow-hidden tw:bg-primary tw:font-body tw:antialiased"
        data-testid="ontology-studio-shell"
        style={ONTOLOGY_STUDIO_STYLE}>
        {renderHeader()}

        {renderWorkspace()}

        {renderOverlays()}
      </main>
    </PageLayoutV1>
  );
};

export default OntologyExplorerPage;
