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
  Box,
  Button,
  Dropdown,
  PageLayout,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowRight,
  ChevronDown,
  Globe01,
  Grid01,
  Plus,
  Share07,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import HeaderBreadcrumb from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import { getGlossaryHomeCrumb } from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.utils';
import OntologyPicker from '../../components/governance/ontology/OntologyPicker/OntologyPicker';
import OntologyStudioWorkspace from '../../components/governance/ontology/OntologyStudioWorkspace/OntologyStudioWorkspace';
import { useOntologyAiCapability } from '../../components/OntologyExplorer/hooks/useOntologyAiCapability';
import {
  OntologyEditLeaseState,
  useOntologyEditLease,
} from '../../components/OntologyExplorer/hooks/useOntologyEditLease';
import OntologyAiAssistant from '../../components/OntologyExplorer/OntologyAiAssistant';
import OntologyEditLeaseStatus from '../../components/OntologyExplorer/OntologyEditLeaseStatus';
import OntologyExplorer from '../../components/OntologyExplorer/OntologyExplorer';
import { OntologyGraphData } from '../../components/OntologyExplorer/OntologyExplorer.interface';
import OntologyImportExportMenu from '../../components/OntologyExplorer/OntologyImportExportMenu';
import OntologyLibrary from '../../components/OntologyExplorer/OntologyLibrary';
import OntologyMemoryReviewPanel from '../../components/OntologyExplorer/OntologyMemoryReviewPanel';
import OntologyModelingWorkbench from '../../components/OntologyExplorer/OntologyModelingWorkbench';
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
import { useIsAiMode } from '../../hooks/useAppMode';
import { getOntology } from '../../rest/ontologyAPI';
import { checkPermission } from '../../utils/PermissionsUtils';
import { generateUUID } from '../../utils/StringUtils';
import { showErrorToast, showInfoToast } from '../../utils/ToastUtils';

// 'review' has no tab; a memory's "view draft" link (?draft=) still opens it.
type StudioMode = 'view' | 'edit' | 'query' | 'ai' | 'review';
type ViewSurface = 'graph' | 'tree';
type EditSurface = 'graph' | 'model';
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

const ALL_GLOSSARIES_KEY = 'all-glossaries';

const GlossaryMenuIcon = ({ className }: { className?: string }) => (
  <Globe01 aria-hidden="true" className={className} />
);

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
  showModelingWorkbench: boolean;
  showQuerySurface: boolean;
  showReviewSurface: boolean;
  showRdfDisabledNotice: boolean;
}

function computeVisibilityFlags(
  mode: StudioMode,
  editSurface: EditSurface,
  isOntologyAiEnabled: boolean,
  isRdfEnabled: boolean,
  isCapabilityLoading: boolean
): StudioVisibilityFlags {
  return {
    showAiAssistant: mode === 'ai' && isOntologyAiEnabled,
    showHealth: mode === 'view' || mode === 'edit',
    showModelingWorkbench: mode === 'edit' && editSurface === 'model',
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

function getEditSubModeConfiguration(
  editSurface: EditSurface,
  t: TFunction
): StudioSubMode {
  return {
    id: editSurface,
    items: [
      { id: 'graph', label: t('label.graph') },
      { id: 'model', label: t('label.model') },
    ],
  };
}

function getQuerySubModeConfiguration(
  querySurface: QuerySurface,
  isRdfEnabled: boolean,
  t: TFunction
): StudioSubMode {
  return {
    id: querySurface,
    items: isRdfEnabled
      ? [
          { id: 'console', label: t('label.sparql-console') },
          { id: 'builder', label: t('label.visual-builder') },
        ]
      : [],
  };
}

function getSubModeConfiguration(
  mode: StudioMode,
  surfaces: {
    viewSurface: ViewSurface;
    editSurface: EditSurface;
    querySurface: QuerySurface;
  },
  isRdfEnabled: boolean,
  t: TFunction
): StudioSubMode {
  const configByMode: Record<StudioMode, () => StudioSubMode> = {
    ai: () => ({ id: 'ai', items: [] }),
    edit: () => getEditSubModeConfiguration(surfaces.editSurface, t),
    query: () =>
      getQuerySubModeConfiguration(surfaces.querySurface, isRdfEnabled, t),
    review: () => ({ id: 'review', items: [] }),
    view: () => getViewSubModeConfiguration(surfaces.viewSurface, t),
  };

  return configByMode[mode]();
}

function resolveViewSurfaceChange(id: string): ViewSurface | undefined {
  return id === 'graph' || id === 'tree' ? (id as ViewSurface) : undefined;
}

function resolveEditSurfaceChange(id: string): EditSurface | undefined {
  return id === 'graph' || id === 'model' ? (id as EditSurface) : undefined;
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

const OntologyExplorerPage: React.FC = () => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const { isAdminUser } = useAuth();
  const { permissions } = usePermissionProvider();
  const {
    isEnabled: isOntologyAiEnabled,
    isRdfEnabled,
    isLoading: isCapabilityLoading,
  } = useOntologyAiCapability();
  const initialDraftId = useLinkedDraftId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadedOntology, setLoadedOntology] = useState<Ontology>();
  const [isCreatingOntology, setIsCreatingOntology] = useState(false);
  const [mode, setMode] = useState<StudioMode>(() =>
    studioModeFor(initialDraftId)
  );
  const ontologyId = searchParams.get('ontology');
  const selectedOntology =
    loadedOntology?.id === ontologyId ? loadedOntology : undefined;
  const canCreateOntology = canCreateNativeOntology(isAdminUser, permissions);
  const selectOntology = (ontology?: Ontology) => {
    setLoadedOntology(ontology);
    setIsCreatingOntology(false);
    if ((ontology?.id ?? null) !== ontologyId) {
      setMode('view');
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if ((ontology?.id ?? null) !== current.get('ontology')) {
        next.delete(DRAFT_SEARCH_PARAM);
      }
      if (ontology) {
        next.set('ontology', ontology.id);
      } else {
        next.delete('ontology');
      }

      return next;
    });
  };
  useEffect(() => {
    if (!ontologyId) {
      setLoadedOntology(undefined);

      return;
    }
    const controller = new AbortController();
    getOntology(ontologyId, 'owners,reviewers', controller.signal)
      .then((ontology) => {
        if (!controller.signal.aborted) {
          setLoadedOntology(ontology);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          showErrorToast(error);
          setMode('view');
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.delete('ontology');
            next.delete(DRAFT_SEARCH_PARAM);

            return next;
          });
        }
      });

    return () => controller.abort();
  }, [ontologyId, setSearchParams]);
  const [viewSurface, setViewSurface] = useState<ViewSurface>('graph');
  const [editSurface, setEditSurface] = useState<EditSurface>('graph');
  const [querySurface, setQuerySurface] = useState<QuerySurface>('console');
  const [stats, setStats] = useState<string[]>([]);
  const [glossaries, setGlossaries] = useState<Glossary[]>([]);
  const [graphData, setGraphData] = useState<OntologyGraphData | null>(null);
  const [relationTypes, setRelationTypes] = useState<RelationshipType[]>([]);
  const [selectedGlossaryId, setSelectedGlossaryId] = useState<string>();
  const [authoringGlossaryId, setAuthoringGlossaryId] = useState<string>();
  const [pendingGlossaryName, setPendingGlossaryName] = useState<string>();
  const [explorerRevision, setExplorerRevision] = useState(0);
  const [generatedQuery, setGeneratedQuery] = useState<string>();
  const [queryConsoleKey, setQueryConsoleKey] = useState(0);
  const [isNewQueryRequested, setIsNewQueryRequested] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [searchSlot, setSearchSlot] = useState<HTMLDivElement | null>(null);
  const [conceptDraft, setConceptDraft] = useState<{
    defaultGlossaryId?: string;
    id: string;
  }>();

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
  }, [glossaries, pendingGlossaryName]);

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
  const selectedGlossary = glossaries.find(
    (glossary) => glossary.id === selectedGlossaryId
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
      !ontologyId &&
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
    setEditSurface('graph');
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
  const selectedGlossaryLabel = getSelectedGlossaryLabel(
    selectedGlossary,
    allGlossariesLabel
  );
  const termCount = getStatCount(stats, t('label.term-plural'));
  const relationCount = getStatCount(stats, t('label.relation-plural'));
  const explorerSurface = mode === 'view' ? viewSurface : 'graph';

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
  const modeTabs = computeModeTabs(t, canEditOntology, isOntologyAiEnabled);

  useEffect(() => {
    const isUnavailableEditMode =
      (mode === 'edit' || mode === 'review') && !canEditOntology;
    if (isUnavailableEditMode || (mode === 'ai' && !isOntologyAiEnabled)) {
      setMode('view');
    }
  }, [canEditOntology, isOntologyAiEnabled, mode]);

  const subModeConfiguration = getSubModeConfiguration(
    mode,
    { editSurface, querySurface, viewSurface },
    isRdfEnabled,
    t
  );

  const handleSubModeChange = useCallback(
    (id: string) => {
      if (mode === 'view') {
        const nextViewSurface = resolveViewSurfaceChange(id);
        if (nextViewSurface) {
          setViewSurface(nextViewSurface);
        }

        return;
      }
      if (mode === 'edit') {
        const nextEditSurface = resolveEditSurfaceChange(id);
        if (nextEditSurface) {
          if (nextEditSurface === 'model') {
            setConceptDraft(undefined);
          }
          setEditSurface(nextEditSurface);
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
    showModelingWorkbench,
    showQuerySurface,
    showReviewSurface,
    showRdfDisabledNotice,
  } = computeVisibilityFlags(
    mode,
    editSurface,
    isOntologyAiEnabled,
    isRdfEnabled,
    isCapabilityLoading
  );

  const showDefaultSurface =
    !showAiAssistant &&
    !showQuerySurface &&
    !showReviewSurface &&
    !showRdfDisabledNotice;

  const defaultModeContent = showModelingWorkbench ? (
    <OntologyModelingWorkbench
      glossaries={glossaries}
      graphData={graphData}
      selectedGlossary={selectedGlossary}
    />
  ) : (
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

  function renderGlossaryMenu() {
    return (
      <div className="tw:relative tw:shrink-0">
        <Dropdown.Root>
          <Button
            color="secondary"
            data-selected-glossary-id={selectedGlossaryId ?? ''}
            data-testid="ontology-glossary-menu-trigger"
            iconLeading={Globe01}
            iconTrailing={ChevronDown}
            size="xs">
            {selectedGlossaryLabel}
          </Button>
          <Dropdown.Popover className="tw:w-60" placement="bottom left">
            <Dropdown.Menu
              aria-label={t('label.glossary-plural')}
              selectedKeys={new Set([selectedGlossaryId ?? ALL_GLOSSARIES_KEY])}
              onAction={(key) => {
                selectOntology(undefined);
                setSelectedGlossaryId(
                  key === ALL_GLOSSARIES_KEY ? undefined : String(key)
                );
              }}>
              <Dropdown.Item
                addon={`${glossaries.length} ${t(
                  'label.glossary-plural'
                ).toLocaleLowerCase()}`}
                icon={GlossaryMenuIcon}
                id={ALL_GLOSSARIES_KEY}
                label={allGlossariesLabel}
                textValue={allGlossariesLabel}
              />
              {glossaries.map((glossary) => {
                const label = glossary.displayName ?? glossary.name;

                return (
                  <Dropdown.Item
                    addon={`${glossary.termCount ?? 0} ${t(
                      'label.term-plural'
                    ).toLocaleLowerCase()}`}
                    data-testid={glossary.id}
                    icon={GlossaryMenuIcon}
                    id={glossary.id}
                    key={glossary.id}
                    label={label}
                    textValue={label}
                  />
                );
              })}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      </div>
    );
  }

  function handleModeChange(nextMode: StudioMode) {
    if (nextMode !== 'edit') {
      setConceptDraft(undefined);
    }
    setMode(nextMode);
  }

  function renderModeTabs() {
    return (
      <Tabs
        selectedKey={mode}
        onSelectionChange={(key) => handleModeChange(key as StudioMode)}>
        <Tabs.List
          className="tw:mt-2 tw:gap-6 tw:before:hidden"
          size="sm"
          type="underline">
          {modeTabs.map((tab) => (
            <Tabs.Item
              data-testid={`mode-tab-${tab.id}`}
              id={tab.id}
              key={tab.id}>
              {tab.label}
            </Tabs.Item>
          ))}
        </Tabs.List>
      </Tabs>
    );
  }

  function renderPrimaryAction() {
    if (mode === 'view' && canEditOntology) {
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

    if (mode === 'edit' && editSurface === 'graph' && canCreateConcept) {
      return (
        <Button
          color="primary"
          data-testid="ontology-add-concept"
          iconLeading={Plus}
          isDisabled={Boolean(conceptDraft)}
          size="xs"
          onPress={() => {
            const defaultGlossaryId = graphLeaseGlossary?.id;
            setAuthoringGlossaryId(defaultGlossaryId);
            setConceptDraft({
              defaultGlossaryId,
              id: `ontology-concept-draft-${generateUUID()}`,
            });
          }}>
          {t('label.add-entity', { entity: t('label.concept') })}
        </Button>
      );
    }

    if (mode === 'query' && isRdfEnabled) {
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

  function renderHeader() {
    return (
      <PageLayout.PageHeader
        actions={
          <Box align="center" gap={2} wrap="wrap">
            {renderGlossaryMenu()}
            <OntologyPicker
              value={selectedOntology}
              onChange={selectOntology}
            />
            {canCreateOntology && (
              <Button
                color="secondary"
                data-testid="ontology-create"
                size="xs"
                onPress={() => {
                  selectOntology(undefined);
                  setIsCreatingOntology(true);
                }}>
                {t('label.add-entity', { entity: t('label.ontology') })}
              </Button>
            )}
            {!selectedOntology && !isCreatingOntology && (
              <>
                <OntologyImportExportMenu
                  glossaries={glossaries}
                  glossary={selectedGlossary}
                  isAdminUser={Boolean(isAdminUser)}
                  relationCount={relationCount}
                  termCount={termCount}
                />
                <Button
                  aria-haspopup="dialog"
                  color="secondary"
                  data-testid="ontology-library-trigger"
                  iconLeading={Grid01}
                  size="xs"
                  onPress={() => setIsLibraryOpen(true)}>
                  {t('label.library')}
                </Button>
                {renderPrimaryAction()}
              </>
            )}
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
        className="tw:mx-2 tw:mt-2 tw:shrink-0"
        data-testid="ontology-studio-header"
        footer={
          !selectedOntology && !isCreatingOntology
            ? renderModeTabs()
            : undefined
        }
        subtitle={t('message.ontology-studio-description')}
        title={t('label.ontology-studio')}
        variant={isAiMode ? 'gradient' : 'flat'}
      />
    );
  }

  function renderSubModeNav() {
    if (mode === 'ai' || mode === 'review') {
      return null;
    }

    return (
      <nav className="tw:flex tw:h-14 tw:shrink-0 tw:items-center tw:gap-3 tw:overflow-x-auto tw:border-b tw:border-secondary tw:bg-primary tw:px-5">
        {subModeConfiguration.items.length > 0 ? (
          <Tabs
            className="tw:w-auto"
            selectedKey={subModeConfiguration.id}
            onSelectionChange={(key) => handleSubModeChange(String(key))}>
            <Tabs.List size="sm" type="button-border">
              {subModeConfiguration.items.map((item) => (
                <Tabs.Item
                  data-testid={`submode-tab-${item.id}`}
                  id={item.id}
                  key={item.id}>
                  {item.label}
                </Tabs.Item>
              ))}
            </Tabs.List>
          </Tabs>
        ) : null}
        {showDefaultSurface && !showModelingWorkbench ? (
          <div
            className="tw:min-w-35 tw:max-w-70 tw:flex-1 tw:border-l tw:border-secondary tw:pl-3 tw:empty:hidden"
            ref={setSearchSlot}
          />
        ) : null}
        <span className="tw:flex-1" />
        {mode === 'edit' && leaseGlossary ? (
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
          {termCount} {t('label.term-plural').toLocaleLowerCase()}{' '}
          <span aria-hidden="true">·</span> {relationCount}{' '}
          {t('label.relation-plural').toLocaleLowerCase()}
        </Typography>
      </nav>
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
      return (
        <div className="tw:min-h-0 tw:min-w-0 tw:flex-1 tw:overflow-auto">
          {querySurface === 'console' ? (
            <OntologyStudioQueryConsole
              createQueryOnMount={isNewQueryRequested}
              graphData={graphData}
              initialQuery={generatedQuery}
              key={queryConsoleKey}
              relationTypes={relationTypes}
              selectedGlossaryIds={selectedGlossaryIds}
              onQueryCreated={() => setIsNewQueryRequested(false)}
            />
          ) : (
            <OntologyVisualQueryBuilder
              graphData={graphData}
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

  const renderWorkspace = () => {
    if (ontologyId && !selectedOntology) {
      return <Typography role="status">{t('label.loading')}</Typography>;
    }
    if (selectedOntology || isCreatingOntology) {
      return (
        <OntologyStudioWorkspace
          canCreate={canCreateOntology}
          initialDraftId={initialDraftId}
          key={selectedOntology?.id ?? 'new'}
          ontology={selectedOntology}
          onSaved={selectOntology}
        />
      );
    }

    return (
      <>
        {renderSubModeNav()}
        {renderMainSection()}
      </>
    );
  };

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

        {isLibraryOpen ? (
          <OntologyLibrary
            canInstall={Boolean(isAdminUser)}
            installedPacks={
              selectedGlossary?.ontologyConfiguration?.installedPacks ?? []
            }
            onClose={() => setIsLibraryOpen(false)}
            onOpenGlossary={handleOpenGlossary}
          />
        ) : null}
      </main>
    </PageLayoutV1>
  );
};

export default OntologyExplorerPage;
