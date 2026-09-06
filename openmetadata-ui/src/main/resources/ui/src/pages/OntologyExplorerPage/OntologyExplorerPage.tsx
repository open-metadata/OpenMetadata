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

import { Button, Dropdown, Typography } from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  Globe01,
  Grid01,
  LayersThree01,
  Plus,
  Share07,
} from '@untitledui/icons';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyExplorer } from '../../components/OntologyExplorer';
import { useOntologyAiCapability } from '../../components/OntologyExplorer/hooks/useOntologyAiCapability';
import { useOntologyEditLease } from '../../components/OntologyExplorer/hooks/useOntologyEditLease';
import OntologyAiAssistant from '../../components/OntologyExplorer/OntologyAiAssistant';
import OntologyEditLeaseStatus from '../../components/OntologyExplorer/OntologyEditLeaseStatus';
import { OntologyGraphData } from '../../components/OntologyExplorer/OntologyExplorer.interface';
import OntologyImportExportMenu from '../../components/OntologyExplorer/OntologyImportExportMenu';
import OntologyLibrary from '../../components/OntologyExplorer/OntologyLibrary';
import OntologyModelingWorkbench from '../../components/OntologyExplorer/OntologyModelingWorkbench';
import { ONTOLOGY_STUDIO_STYLE } from '../../components/OntologyExplorer/OntologyStudio.styles';
import OntologyStudioQueryConsole from '../../components/OntologyExplorer/OntologyStudioQueryConsole';
import OntologyVisualQueryBuilder from '../../components/OntologyExplorer/OntologyVisualQueryBuilder';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { Glossary } from '../../generated/entity/data/glossary';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { Operation } from '../../generated/entity/policies/policy';
import { useAuth } from '../../hooks/authHooks';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { checkPermission } from '../../utils/PermissionsUtils';
import { generateUUID } from '../../utils/StringUtils';

type StudioMode = 'view' | 'edit' | 'query' | 'ai';
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
  label: string;
}

const MODE_TAB_CLASS =
  'tw:flex tw:items-center tw:justify-center tw:rounded-lg tw:border-0 tw:px-5 tw:py-2 ' +
  'tw:font-body tw:text-[13px] tw:leading-normal tw:font-semibold tw:transition-colors ' +
  'tw:focus-visible:outline-2 tw:focus-visible:outline-offset-1 tw:focus-visible:outline-brand-600';
const SUBMODE_TAB_CLASS =
  'tw:flex tw:items-center tw:justify-center tw:rounded-[7px] tw:border-0 tw:px-[13px] tw:py-1.5 ' +
  'tw:font-body tw:text-xs tw:leading-normal tw:font-semibold tw:transition-colors ' +
  'tw:focus-visible:outline-2 tw:focus-visible:outline-offset-1 tw:focus-visible:outline-brand-600';
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

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toLocaleUpperCase();
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

const OntologyExplorerPage: React.FC = () => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const { permissions } = usePermissionProvider();
  const { currentUser } = useApplicationStore();
  const {
    isEnabled: isOntologyAiEnabled,
    isRdfEnabled,
    isLoading: isCapabilityLoading,
  } = useOntologyAiCapability();
  const [mode, setMode] = useState<StudioMode>('view');
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
  const graphLeaseGlossary = selectedGlossary ?? authoringGlossary;
  const leaseGlossary = conceptDraft
    ? authoringGlossary ??
      glossaries.find(
        (glossary) => glossary.id === conceptDraft.defaultGlossaryId
      )
    : graphLeaseGlossary;
  const editLease = useOntologyEditLease({
    isActive: mode === 'edit' && Boolean(leaseGlossary),
    resourceId: leaseGlossary?.id,
    resourceType: EntityType.GLOSSARY,
  });
  const isLeaseForCurrentGlossary =
    !editLease.lock || editLease.lock.resourceId === leaseGlossary?.id;
  const isLeaseOwned = editLease.isOwned && isLeaseForCurrentGlossary;
  const editLeaseState =
    editLease.isOwned && !isLeaseForCurrentGlossary
      ? ('acquiring' as const)
      : editLease.state;
  const selectedGlossaryIds = useMemo(
    () => (selectedGlossaryId ? [selectedGlossaryId] : []),
    [selectedGlossaryId]
  );
  const selectedGlossaryLabel =
    selectedGlossary?.displayName ??
    selectedGlossary?.name ??
    allGlossariesLabel;
  const termCount = getStatCount(stats, t('label.term-plural'));
  const relationCount = getStatCount(stats, t('label.relation-plural'));
  const isolatedCount = getStatCount(stats, t('label.isolated'));
  const userName =
    currentUser?.displayName ?? currentUser?.name ?? t('label.user');
  const userInitials = getInitials(userName);
  const explorerSurface = mode === 'view' ? viewSurface : 'graph';

  const canEditOntology =
    isAdminUser ||
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
    );
  const canCreateConcept =
    canEditOntology ||
    Boolean(isAdminUser) ||
    checkPermission(
      Operation.Create,
      ResourceEntity.GLOSSARY_TERM,
      permissions
    );
  const aiModeTabs: StudioModeTab[] = isOntologyAiEnabled
    ? [{ id: 'ai', label: t('label.ai') }]
    : [];
  const editModeTabs: StudioModeTab[] = canEditOntology
    ? [{ id: 'edit', label: t('label.edit') }]
    : [];
  const modeTabs: StudioModeTab[] = [
    { id: 'view', label: t('label.view') },
    ...editModeTabs,
    { id: 'query', label: t('label.query') },
    ...aiModeTabs,
  ];

  useEffect(() => {
    if (
      (mode === 'edit' && !canEditOntology) ||
      (mode === 'ai' && !isOntologyAiEnabled)
    ) {
      setMode('view');
    }
  }, [canEditOntology, isOntologyAiEnabled, mode]);
  let subModeConfiguration: StudioSubMode;

  switch (mode) {
    case 'view':
      subModeConfiguration = {
        id: viewSurface,
        items: [
          { id: 'graph', label: t('label.graph') },
          { id: 'tree', label: t('label.tree') },
        ],
        label: t('label.explore'),
      };

      break;
    case 'edit':
      subModeConfiguration = {
        id: editSurface,
        items: [
          { id: 'graph', label: t('label.graph') },
          { id: 'model', label: t('label.model') },
        ],
        label: t('label.author'),
      };

      break;
    case 'query':
      subModeConfiguration = {
        id: querySurface,
        items: isRdfEnabled
          ? [
              { id: 'console', label: t('label.sparql-console') },
              { id: 'builder', label: t('label.visual-builder') },
            ]
          : [],
        label: t('label.query'),
      };

      break;
    case 'ai':
    default:
      subModeConfiguration = {
        id: 'ai',
        items: [],
        label: t('label.ontology-ai-assistant'),
      };
  }

  const handleSubModeChange = (id: string) => {
    switch (mode) {
      case 'view':
        if (id === 'graph' || id === 'tree') {
          setViewSurface(id);
        }

        break;
      case 'edit':
        if (id === 'graph' || id === 'model') {
          if (id === 'model') {
            setConceptDraft(undefined);
          }
          setEditSurface(id);
        }

        break;
      case 'query':
        if (id === 'console' || id === 'builder') {
          setQuerySurface(id);
        }

        break;
      default:
        break;
    }
  };

  const renderMainContent = () => {
    if (mode === 'ai' && isOntologyAiEnabled) {
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

    if (mode === 'query' && !isRdfEnabled && !isCapabilityLoading) {
      return <RdfDisabledNotice />;
    }

    if (mode === 'query') {
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

    if (mode === 'edit' && editSurface === 'model') {
      return (
        <OntologyModelingWorkbench
          glossaries={glossaries}
          graphData={graphData}
          selectedGlossary={selectedGlossary}
        />
      );
    }

    return (
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
        showHealth={mode === 'view'}
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
        onRequestEdit={() => {
          setEditSurface('graph');
          setMode('edit');
        }}
        onSelectedNodeChange={(node) =>
          setAuthoringGlossaryId(node?.glossaryId)
        }
        onStatsChange={handleStatsChange}
      />
    );
  };

  return (
    <PageLayoutV1
      fullHeight
      className="tw:p-0!"
      mainContainerClassName="ontology-studio-page-layout"
      pageTitle={t('label.ontology-studio')}>
      <main
        className="tw:flex tw:h-full tw:min-h-0 tw:flex-col tw:overflow-hidden tw:bg-tertiary tw:font-body tw:antialiased"
        data-testid="ontology-studio-shell"
        style={ONTOLOGY_STUDIO_STYLE}>
        <header className="tw:flex tw:h-14 tw:shrink-0 tw:items-center tw:gap-3.5 tw:overflow-x-auto tw:border-b tw:border-secondary tw:bg-primary tw:px-[18px]">
          <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-[9px]">
            <span className="tw:grid tw:size-7 tw:place-items-center tw:rounded-lg tw:bg-brand-solid tw:text-white">
              <LayersThree01 aria-hidden="true" className="tw:size-[17px]" />
            </span>
            <h1
              className="tw:m-0 tw:font-body tw:text-[15px] tw:leading-normal tw:font-bold tw:tracking-[-0.01em] tw:text-primary"
              data-testid="heading">
              {t('label.ontology-studio')}
            </h1>
          </div>
          <span
            aria-hidden="true"
            className="tw:h-[22px] tw:w-px tw:bg-quaternary"
          />

          <div className="tw:relative tw:shrink-0">
            <Dropdown.Root>
              <Button
                noTextPadding
                className={classNames(
                  'tw:flex tw:items-center tw:gap-[7px] tw:rounded-lg tw:border tw:border-secondary',
                  'tw:bg-primary tw:px-[11px] tw:py-1.5 tw:font-body tw:text-xs tw:leading-normal',
                  'tw:font-medium tw:text-secondary tw:focus-visible:outline-2 tw:focus-visible:outline-offset-1',
                  'tw:focus-visible:outline-brand-600'
                )}
                color="tertiary"
                data-selected-glossary-id={selectedGlossaryId ?? ''}
                data-testid="ontology-glossary-menu-trigger"
                iconLeading={
                  <Globe01
                    aria-hidden="true"
                    className="tw:size-3.5 tw:text-fg-tertiary"
                  />
                }
                iconTrailing={
                  <ChevronDown
                    aria-hidden="true"
                    className="tw:size-[13px] tw:text-fg-quaternary"
                  />
                }>
                <span className="tw:max-w-52 tw:truncate tw:font-semibold">
                  {selectedGlossaryLabel}
                </span>
              </Button>
              <Dropdown.Popover className="tw:w-60" placement="bottom left">
                <Dropdown.Menu
                  aria-label={t('label.glossary-plural')}
                  selectedKeys={
                    new Set([selectedGlossaryId ?? ALL_GLOSSARIES_KEY])
                  }
                  onAction={(key) =>
                    setSelectedGlossaryId(
                      key === ALL_GLOSSARIES_KEY ? undefined : String(key)
                    )
                  }>
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

          <div className="tw:flex tw:min-w-0 tw:flex-1 tw:justify-center">
            <div className="tw:flex tw:gap-[3px] tw:rounded-[10px] tw:border tw:border-secondary tw:bg-tertiary tw:p-[3px]">
              {modeTabs.map((tab) => (
                <Button
                  noTextPadding
                  aria-pressed={mode === tab.id}
                  className={classNames(
                    MODE_TAB_CLASS,
                    mode === tab.id
                      ? 'tw:bg-primary tw:text-brand-secondary tw:shadow-xs'
                      : 'tw:bg-transparent tw:text-quaternary'
                  )}
                  color="tertiary"
                  data-testid={`mode-tab-${tab.id}`}
                  key={tab.id}
                  onClick={() => {
                    if (tab.id !== 'edit') {
                      setConceptDraft(undefined);
                    }
                    setMode(tab.id);
                  }}>
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>

          <OntologyImportExportMenu
            glossaries={glossaries}
            glossary={selectedGlossary}
            isAdminUser={Boolean(isAdminUser)}
            relationCount={relationCount}
            termCount={termCount}
          />

          <Button
            aria-haspopup="dialog"
            className="tw:gap-[7px]! tw:rounded-[9px]! tw:border tw:border-primary tw:px-3! tw:py-[7px]! tw:text-xs! tw:font-semibold! tw:shadow-none! tw:before:hidden tw:after:outline-0!"
            color="secondary"
            data-testid="ontology-library-trigger"
            iconLeading={
              <Grid01 className="tw:size-[15px] tw:text-fg-brand-primary" />
            }
            size="sm"
            onPress={() => setIsLibraryOpen(true)}>
            {t('label.library')}
          </Button>

          <div
            className={classNames(
              'tw:flex tw:shrink-0 tw:items-center tw:gap-1.5 tw:rounded-full tw:border',
              'tw:border-utility-warning-200 tw:bg-utility-warning-50 tw:px-[11px] tw:py-[5px] tw:font-body',
              'tw:text-[11px] tw:leading-normal tw:font-semibold tw:text-utility-warning-700'
            )}
            data-testid="ontology-header-isolated-count">
            <span
              aria-hidden="true"
              className="tw:size-[7px] tw:rounded-full tw:bg-utility-warning-500"
            />
            <span>{isolatedCount}</span>
            <span className="tw:lowercase">{t('label.isolated')}</span>
          </div>

          <span
            aria-label={userName}
            className="tw:grid tw:size-[30px] tw:shrink-0 tw:place-items-center tw:rounded-full tw:bg-brand-solid tw:font-body tw:text-[11px] tw:leading-normal tw:font-bold tw:text-white"
            role="img">
            {userInitials}
          </span>
        </header>

        {mode !== 'ai' ? (
          <nav className="tw:flex tw:h-[46px] tw:shrink-0 tw:items-center tw:gap-2.5 tw:border-b tw:border-secondary tw:bg-primary tw:px-[18px]">
            <span className="tw:font-body tw:text-[11px] tw:leading-normal tw:font-semibold tw:tracking-[0.06em] tw:text-quaternary tw:uppercase">
              {subModeConfiguration.label}
            </span>
            <div className="tw:flex tw:gap-0.5">
              {subModeConfiguration.items.map((item) => (
                <Button
                  noTextPadding
                  aria-pressed={subModeConfiguration.id === item.id}
                  className={classNames(
                    SUBMODE_TAB_CLASS,
                    subModeConfiguration.id === item.id
                      ? 'tw:bg-primary tw:text-brand-secondary tw:shadow-xs'
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
            {mode === 'edit' && editSurface === 'graph' && canCreateConcept ? (
              <Button
                color="secondary"
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
              className="tw:font-body tw:text-[11px] tw:leading-normal tw:font-medium tw:text-quaternary"
              data-testid="ontology-explorer-stats">
              {termCount} {t('label.term-plural').toLocaleLowerCase()}{' '}
              <span aria-hidden="true">·</span> {relationCount}{' '}
              {t('label.relation-plural').toLocaleLowerCase()}
            </span>
          </nav>
        ) : null}

        <section
          className={classNames(
            'tw:flex tw:min-h-0 tw:flex-1',
            mode === 'query' || mode === 'ai'
              ? 'tw:bg-secondary'
              : 'tw:bg-primary'
          )}>
          {renderMainContent()}
        </section>

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
