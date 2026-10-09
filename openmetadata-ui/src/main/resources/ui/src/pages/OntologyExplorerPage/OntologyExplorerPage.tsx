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
  Button,
  FilterSelect,
  Input,
  PageHeader,
  SearchInputIcon,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ClipboardCheck,
  Code01,
  Edit02,
  Eye,
  Globe01,
  Grid01,
  LayersThree01,
  Plus,
  Share07,
  Stars01,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useOntologyAiCapability } from '../../components/OntologyExplorer/hooks/useOntologyAiCapability';
import {
  OntologyEditLeaseState,
  useOntologyEditLease,
} from '../../components/OntologyExplorer/hooks/useOntologyEditLease';
import OntologyAiAssistant from '../../components/OntologyExplorer/OntologyAiAssistant';
import OntologyEditLeaseStatus from '../../components/OntologyExplorer/OntologyEditLeaseStatus';
import OntologyExplorer from '../../components/OntologyExplorer/OntologyExplorer';
import {
  ExplorationMode,
  OntologyGraphData,
} from '../../components/OntologyExplorer/OntologyExplorer.interface';
import OntologyImportExportMenu from '../../components/OntologyExplorer/OntologyImportExportMenu';
import OntologyLibrary from '../../components/OntologyExplorer/OntologyLibrary';
import OntologyMemoryReviewPanel from '../../components/OntologyExplorer/OntologyMemoryReviewPanel';
import OntologyModelingWorkbench from '../../components/OntologyExplorer/OntologyModelingWorkbench';
import { ONTOLOGY_STUDIO_STYLE } from '../../components/OntologyExplorer/OntologyStudio.styles';
import OntologyStudioQueryConsole from '../../components/OntologyExplorer/OntologyStudioQueryConsole';
import OntologyVisualQueryBuilder from '../../components/OntologyExplorer/OntologyVisualQueryBuilder';
import HeaderBreadcrumb from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import {
  getGlossaryHomeCrumb,
  getHomeCrumb,
} from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.utils';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { UIPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { ResourceEntity } from '../../enums/permissions.enum';
import { Glossary } from '../../generated/entity/data/glossary';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { Operation } from '../../generated/entity/policies/policy';
import { useAuth } from '../../hooks/authHooks';
import { useIsAiMode } from '../../hooks/useAppMode';
import { checkPermission } from '../../utils/PermissionsUtils';
import { generateUUID } from '../../utils/StringUtils';

type StudioMode = 'view' | 'edit' | 'query' | 'ai' | 'review';
type ViewSurface = 'graph' | 'tree';
type EditSurface = 'graph' | 'model';
type QuerySurface = 'console' | 'builder';

interface StudioTab {
  id: string;
  label: string;
}

interface StudioModeTab {
  icon: FC<{ className?: string }>;
  id: StudioMode;
  label: string;
}

interface StudioSubMode {
  id: string;
  items: StudioTab[];
  label: string;
}

const SUBMODE_TAB_CLASS =
  'tw:flex tw:items-center tw:justify-center tw:rounded-[7px] tw:border-0 tw:px-[13px] tw:py-1.5 ' +
  'tw:font-body tw:text-xs tw:leading-normal tw:font-semibold tw:transition-colors ' +
  'tw:focus-visible:outline-2 tw:focus-visible:outline-offset-1 tw:focus-visible:outline-brand-600';
const ALL_GLOSSARIES_KEY = 'all-glossaries';

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
    ? [{ icon: Edit02, id: 'edit', label: t('label.edit') }]
    : [];
  const reviewModeTabs: StudioModeTab[] = canEditOntology
    ? [{ icon: ClipboardCheck, id: 'review', label: t('label.needs-review') }]
    : [];
  const aiModeTabs: StudioModeTab[] = isOntologyAiEnabled
    ? [{ icon: Stars01, id: 'ai', label: t('label.ai') }]
    : [];

  return [
    { icon: Eye, id: 'view', label: t('label.view') },
    ...editModeTabs,
    ...reviewModeTabs,
    { icon: Code01, id: 'query', label: t('label.query') },
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
  showDefaultSurface: boolean;
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
  const showAiAssistant = mode === 'ai' && isOntologyAiEnabled;
  const showQuerySurface = mode === 'query';
  const showReviewSurface = mode === 'review';
  const showRdfDisabledNotice =
    showQuerySurface && !isRdfEnabled && !isCapabilityLoading;

  return {
    showAiAssistant,
    showDefaultSurface:
      !showAiAssistant &&
      !showQuerySurface &&
      !showReviewSurface &&
      !showRdfDisabledNotice,
    showModelingWorkbench: mode === 'edit' && editSurface === 'model',
    showQuerySurface,
    showReviewSurface,
    showRdfDisabledNotice,
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
    label: t('label.explore'),
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
    label: t('label.author'),
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
    label: t('label.query'),
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
    ai: () => ({
      id: 'ai',
      items: [],
      label: t('label.ontology-ai-assistant'),
    }),
    edit: () => getEditSubModeConfiguration(surfaces.editSurface, t),
    query: () =>
      getQuerySubModeConfiguration(surfaces.querySurface, isRdfEnabled, t),
    review: () => ({ id: 'review', items: [], label: t('label.needs-review') }),
    view: () => getViewSubModeConfiguration(surfaces.viewSurface, t),
  };

  return configByMode[mode]();
}

interface StudioChrome {
  headerVariant: 'gradient' | 'flat';
  layoutVariant: 'compact' | 'default';
}

// AI mode gets the brand gradient header and the compact page gutters; classic
// keeps the plain white card, matching the Workflow builder.
function getStudioChrome(isAiMode: boolean): StudioChrome {
  return isAiMode
    ? { headerVariant: 'gradient', layoutVariant: 'compact' }
    : { headerVariant: 'flat', layoutVariant: 'default' };
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
  const [mode, setMode] = useState<StudioMode>(() =>
    studioModeFor(initialDraftId)
  );
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
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [conceptSearch, setConceptSearch] = useState('');
  const [explorationMode, setExplorationMode] =
    useState<ExplorationMode>('model');
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
  // Same split as ColumnBulkOperations: the base crumb is chosen per mode, and
  // AI mode renders the trail inside the gradient header.
  const breadcrumbEl = useMemo(
    () => (
      <HeaderBreadcrumb
        noMargin
        items={[
          isAiMode ? getGlossaryHomeCrumb(t) : getHomeCrumb(t),
          { label: t('label.ontology-studio') },
        ]}
        showHome={false}
      />
    ),
    [isAiMode, t]
  );

  const glossaryOptions = useMemo(
    () =>
      glossaries.map((glossary) => ({
        count: glossary.termCount ?? 0,
        icon: Globe01,
        label: glossary.displayName ?? glossary.name,
        value: glossary.id,
      })),
    [glossaries]
  );
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
  const editLease = useOntologyEditLease({
    isActive: mode === 'edit' && Boolean(leaseGlossary),
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
  const selectedGlossaryIds = useMemo(
    () => (selectedGlossaryId ? [selectedGlossaryId] : []),
    [selectedGlossaryId]
  );
  const termCount = getStatCount(stats, t('label.term-plural'));
  const relationCount = getStatCount(stats, t('label.relation-plural'));
  const isolatedCount = getStatCount(stats, t('label.isolated'));
  const explorerSurface = mode === 'view' ? viewSurface : 'graph';

  const { headerVariant, layoutVariant } = getStudioChrome(isAiMode);
  const canEditOntology = computeCanEditOntology(isAdminUser, permissions);
  const changeSetPermissions = computeChangeSetPermissions(
    isAdminUser,
    permissions
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
    showDefaultSurface,
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
      scope="global"
      searchValue={conceptSearch}
      showHealth={mode === 'view'}
      surface={explorerSurface}
      onConceptCreated={(concept) => {
        setConceptDraft(undefined);
        if (concept.glossary?.id) {
          setSelectedGlossaryId(concept.glossary.id);
        }
      }}
      onConceptDraftClose={() => setConceptDraft(undefined)}
      onExplorationModeChange={setExplorationMode}
      onGlossariesChange={handleGlossariesChange}
      onGraphDataChange={handleGraphDataChange}
      onRelationTypesChange={handleRelationTypesChange}
      onRequestEdit={() => {
        setEditSurface('graph');
        setMode('edit');
      }}
      onSearchChange={setConceptSearch}
      onSelectedNodeChange={(node) => setAuthoringGlossaryId(node?.glossaryId)}
      onStatsChange={handleStatsChange}
    />
  );

  function renderGlossaryMenu() {
    return (
      <FilterSelect
        bordered
        searchable
        data-testid="ontology-glossary-menu-trigger"
        label={t('label.glossary')}
        nullOption={{
          count: glossaries.length,
          icon: Globe01,
          label: allGlossariesLabel,
          value: ALL_GLOSSARIES_KEY,
        }}
        options={glossaryOptions}
        selectedValues={[selectedGlossaryId ?? ALL_GLOSSARIES_KEY]}
        selectionMode="single"
        triggerIcon={Globe01}
        triggerVariant="button"
        onChange={([value]) =>
          setSelectedGlossaryId(
            !value || value === ALL_GLOSSARIES_KEY ? undefined : value
          )
        }
      />
    );
  }

  function renderModeTabsBar() {
    return (
      <Tabs
        className="tw:mt-2"
        selectedKey={mode}
        onSelectionChange={(key) => {
          const nextMode = String(key) as StudioMode;
          if (nextMode !== 'edit') {
            setConceptDraft(undefined);
          }
          setMode(nextMode);
        }}>
        <Tabs.List
          aria-label={t('label.ontology-studio')}
          className="tw:gap-7 tw:before:hidden"
          size="sm"
          type="underline">
          {modeTabs.map((tab) => (
            <Tabs.Item
              data-testid={`mode-tab-${tab.id}`}
              id={tab.id}
              key={tab.id}
              label={
                <span className="tw:inline-flex tw:items-center tw:gap-2">
                  <tab.icon aria-hidden="true" className="tw:size-4" />
                  {tab.label}
                </span>
              }
            />
          ))}
        </Tabs.List>
      </Tabs>
    );
  }

  // Lives beside the surface switch rather than floating over the canvas, so
  // the whole toolbar reads as one row. Model-only: it filters concept nodes,
  // which the Data projection does not render.
  function renderConceptSearch() {
    if (!showDefaultSurface || explorerSurface !== 'graph') {
      return null;
    }

    if (explorationMode !== 'model') {
      return null;
    }

    return (
      <div className="tw:w-[260px] tw:shrink-0">
        <Input
          aria-label={t('label.find-concept')}
          icon={SearchInputIcon}
          inputClassName="tw:text-xs"
          inputDataTestId="ontology-graph-search"
          placeholder={`${t('label.find-concept')}…`}
          size="sm"
          value={conceptSearch}
          onChange={setConceptSearch}
        />
      </div>
    );
  }

  function renderSubModeNav() {
    // AI owns the whole surface — it has no Graph/Tree switch and no stats.
    if (subModeConfiguration.items.length === 0) {
      return null;
    }

    return (
      <nav className="tw:flex tw:h-[46px] tw:shrink-0 tw:items-center tw:gap-3 tw:border-b tw:border-secondary tw:bg-surface tw:px-[18px]">
        <div className="tw:flex tw:shrink-0 tw:gap-0.5">
          {subModeConfiguration.items.map((item) => (
            <Button
              noTextPadding
              aria-pressed={subModeConfiguration.id === item.id}
              className={classNames(
                SUBMODE_TAB_CLASS,
                subModeConfiguration.id === item.id
                  ? 'tw:bg-brand-primary tw:text-brand-secondary'
                  : 'tw:bg-transparent tw:text-quaternary'
              )}
              color="tertiary"
              data-testid={`submode-tab-${item.id}`}
              key={item.id}
              onClick={() => handleSubModeChange(item.id)}>
              {item.label}
            </Button>
          ))}
        </div>

        <span className="tw:flex-1" />

        <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-3">
          {renderConceptSearch()}

          {renderGlossaryMenu()}

          {mode === 'edit' && editSurface === 'graph' && canCreateConcept ? (
            <Button
              color="secondary"
              data-testid="ontology-add-concept"
              iconLeading={Plus}
              isDisabled={Boolean(conceptDraft)}
              size="sm"
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
          ) : null}
          {mode === 'edit' && leaseGlossary ? (
            <OntologyEditLeaseStatus
              hasResource
              lock={editLease.lock}
              state={editLeaseState}
              onRetry={editLease.retry}
            />
          ) : null}
          <span
            className="tw:font-body tw:text-[11px] tw:leading-normal tw:font-medium tw:whitespace-nowrap tw:text-quaternary"
            data-testid="ontology-explorer-stats">
            {termCount} {t('label.term-plural').toLocaleLowerCase()}{' '}
            <span aria-hidden="true">·</span> {relationCount}{' '}
            {t('label.relation-plural').toLocaleLowerCase()}
          </span>

          <BadgeWithDot
            color="warning"
            data-testid="ontology-header-isolated-count"
            size="sm"
            type="pill-color">
            {`${isolatedCount} ${t('label.isolated').toLocaleLowerCase()}`}
          </BadgeWithDot>
        </div>
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
              graphData={graphData}
              initialQuery={generatedQuery}
              relationTypes={relationTypes}
              selectedGlossaryIds={selectedGlossaryIds}
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
            : 'tw:bg-surface',
          // The Library is a sibling surface, not an overlay: hiding the graph
          // rather than unmounting it keeps its layout, zoom and loaded data.
          isLibraryOpen && 'tw:hidden'
        )}
        hidden={isLibraryOpen}>
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

  return (
    <PageLayoutV1
      fullHeight
      mainContainerClassName={classNames('ontology-studio-page-layout', {
        'tw:h-full!': isAiMode,
      })}
      pageTitle={t('label.ontology-studio')}
      variant={layoutVariant}>
      <main
        className="tw:flex tw:h-full tw:min-h-0 tw:flex-col tw:overflow-hidden tw:font-body tw:antialiased"
        data-testid="ontology-studio-shell"
        style={ONTOLOGY_STUDIO_STYLE}>
        {!isAiMode && <div className="tw:mb-3 tw:shrink-0">{breadcrumbEl}</div>}

        <PageHeader
          actions={
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
                size="sm"
                onPress={() => setIsLibraryOpen(true)}>
                {t('label.library')}
              </Button>
            </>
          }
          breadcrumb={isAiMode ? breadcrumbEl : undefined}
          className="tw:shrink-0 tw:pb-0!"
          footer={renderModeTabsBar()}
          icon={LayersThree01}
          subtitle={t('message.ontology-studio-subtitle')}
          title={
            <Typography
              ellipsis
              as="h3"
              className="tw:min-w-0"
              data-testid="heading"
              size="text-xl"
              weight="semibold">
              {t('label.ontology-studio')}
            </Typography>
          }
          variant={headerVariant}
        />

        <div className="tw:mt-3 tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden tw:rounded-card tw:border tw:border-secondary tw:bg-surface">
          {isLibraryOpen ? null : renderSubModeNav()}

          {renderMainSection()}

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
        </div>
      </main>
    </PageLayoutV1>
  );
};

export default OntologyExplorerPage;
