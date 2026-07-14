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

import { ChevronDown, Globe01, LayersThree01 } from '@untitledui/icons';
import classNames from 'classnames';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyExplorer } from '../../components/OntologyExplorer';
import { OntologyGraphData } from '../../components/OntologyExplorer/OntologyExplorer.interface';
import OntologyStudioQueryConsole from '../../components/OntologyExplorer/OntologyStudioQueryConsole';
import OntologyVisualQueryBuilder from '../../components/OntologyExplorer/OntologyVisualQueryBuilder';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { Glossary } from '../../generated/entity/data/glossary';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { GlossaryTermRelationType } from '../../rest/settingConfigAPI';

type StudioMode = 'view' | 'edit' | 'query';
type ViewSurface = 'graph' | 'tree';
type EditSurface = 'graph' | 'term';
type QuerySurface = 'console' | 'builder';

interface StudioTab {
  id: string;
  label: string;
}

const MODE_TAB_CLASS =
  'tw:flex tw:items-center tw:justify-center tw:rounded-[8px] tw:border-0 tw:px-5 tw:py-2 ' +
  'tw:font-body tw:text-[13px] tw:leading-[normal] tw:font-semibold tw:transition-colors ' +
  'tw:focus-visible:outline-2 tw:focus-visible:outline-offset-1 tw:focus-visible:outline-brand-600';
const SUBMODE_TAB_CLASS =
  'tw:flex tw:items-center tw:justify-center tw:rounded-[7px] tw:border-0 tw:px-[13px] tw:py-1.5 ' +
  'tw:font-body tw:text-xs tw:leading-[normal] tw:font-semibold tw:transition-colors ' +
  'tw:focus-visible:outline-2 tw:focus-visible:outline-offset-1 tw:focus-visible:outline-brand-600';

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

const OntologyExplorerPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [mode, setMode] = useState<StudioMode>('view');
  const [viewSurface, setViewSurface] = useState<ViewSurface>('graph');
  const [editSurface, setEditSurface] = useState<EditSurface>('graph');
  const [querySurface, setQuerySurface] = useState<QuerySurface>('console');
  const [stats, setStats] = useState<string[]>([]);
  const [glossaries, setGlossaries] = useState<Glossary[]>([]);
  const [graphData, setGraphData] = useState<OntologyGraphData | null>(null);
  const [relationTypes, setRelationTypes] = useState<
    GlossaryTermRelationType[]
  >([]);
  const [selectedGlossaryId, setSelectedGlossaryId] = useState<string>();
  const [isGlossaryMenuOpen, setIsGlossaryMenuOpen] = useState(false);
  const glossaryMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isGlossaryMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        glossaryMenuRef.current &&
        !glossaryMenuRef.current.contains(event.target as Node)
      ) {
        setIsGlossaryMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsGlossaryMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGlossaryMenuOpen]);

  const handleStatsChange = useCallback((newStats: string[]) => {
    setStats(newStats);
  }, []);

  const handleGlossariesChange = useCallback((items: Glossary[]) => {
    setGlossaries(items);
  }, []);

  const handleGraphDataChange = useCallback((data: OntologyGraphData) => {
    setGraphData(data);
  }, []);

  const handleRelationTypesChange = useCallback(
    (items: GlossaryTermRelationType[]) => {
      setRelationTypes(items);
    },
    []
  );

  const allGlossariesLabel = useMemo(() => {
    const label = t('label.all-glossaries');

    return `${label.charAt(0)}${label.slice(1).toLocaleLowerCase()}`;
  }, [t]);
  const selectedGlossary = glossaries.find(
    (glossary) => glossary.id === selectedGlossaryId
  );
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

  const modeTabs: StudioTab[] = [
    { id: 'view', label: t('label.view') },
    { id: 'edit', label: t('label.edit') },
    { id: 'query', label: t('label.query') },
  ];
  const subMode =
    mode === 'view'
      ? viewSurface
      : mode === 'edit'
      ? editSurface
      : querySurface;
  const subModeLabel =
    mode === 'view'
      ? t('label.explore')
      : mode === 'edit'
      ? t('label.author')
      : t('label.query');
  const subModeItems: StudioTab[] =
    mode === 'view'
      ? [
          { id: 'graph', label: t('label.graph') },
          { id: 'tree', label: t('label.tree') },
        ]
      : mode === 'edit'
      ? [
          { id: 'graph', label: t('label.graph') },
          { id: 'term', label: t('label.term') },
        ]
      : [
          { id: 'console', label: t('label.sparql-console') },
          { id: 'builder', label: t('label.visual-builder') },
        ];

  const handleSubModeChange = (id: string) => {
    if (mode === 'view' && (id === 'graph' || id === 'tree')) {
      setViewSurface(id);
    } else if (mode === 'edit' && (id === 'graph' || id === 'term')) {
      setEditSurface(id);
    } else if (mode === 'query' && (id === 'console' || id === 'builder')) {
      setQuerySurface(id);
    }
  };

  return (
    <PageLayoutV1
      fullHeight
      className="tw:p-0!"
      mainContainerClassName="ontology-studio-page-layout"
      pageContainerStyle={{
        height: 'calc(100vh - var(--ant-navbar-height))',
        overflow: 'hidden',
      }}
      pageTitle={t('label.ontology-studio')}>
      <main
        className="tw:flex tw:h-full tw:min-h-0 tw:flex-col tw:overflow-hidden tw:bg-gray-warm-100 tw:font-body tw:antialiased"
        data-testid="ontology-studio-shell">
        <header className="tw:flex tw:h-14 tw:shrink-0 tw:items-center tw:gap-3.5 tw:border-b tw:border-gray-200 tw:bg-white tw:px-[18px]">
          <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-[9px]">
            <span className="tw:grid tw:size-7 tw:place-items-center tw:rounded-lg tw:bg-[linear-gradient(160deg,#03A0FF,#016AFB)] tw:text-white">
              <LayersThree01 aria-hidden="true" className="tw:size-[17px]" />
            </span>
            <h1
              className="tw:m-0 tw:font-body tw:text-[15px] tw:leading-[normal] tw:font-bold tw:tracking-[-0.01em] tw:text-gray-900"
              data-testid="heading">
              {t('label.ontology-studio')}
            </h1>
          </div>

          <span
            aria-hidden="true"
            className="tw:h-[22px] tw:w-px tw:bg-gray-200"
          />

          <div className="tw:relative tw:shrink-0" ref={glossaryMenuRef}>
            <button
              aria-expanded={isGlossaryMenuOpen}
              aria-haspopup="menu"
              className={classNames(
                'tw:flex tw:items-center tw:gap-[7px] tw:rounded-lg tw:border tw:border-gray-200',
                'tw:bg-white tw:px-[11px] tw:py-1.5 tw:font-body tw:text-xs tw:leading-[normal]',
                'tw:font-medium tw:text-gray-700 tw:focus-visible:outline-2 tw:focus-visible:outline-offset-1',
                'tw:focus-visible:outline-brand-600'
              )}
              data-testid="ontology-glossary-menu-trigger"
              type="button"
              onClick={() => setIsGlossaryMenuOpen((open) => !open)}>
              <Globe01
                aria-hidden="true"
                className="tw:size-3.5 tw:text-gray-500"
              />
              <span className="tw:max-w-52 tw:truncate tw:font-semibold">
                {selectedGlossaryLabel}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="tw:size-[13px] tw:text-gray-400"
              />
            </button>

            {isGlossaryMenuOpen ? (
              <div
                aria-label={t('label.glossary-plural')}
                className={classNames(
                  'tw:absolute tw:left-0 tw:top-[42px] tw:z-60 tw:w-[236px] tw:rounded-[10px]',
                  'tw:border tw:border-gray-200 tw:bg-white tw:p-1.5 tw:shadow-[0_12px_24px_-8px_rgba(10,13,18,0.18)]'
                )}
                role="menu">
                <button
                  aria-checked={!selectedGlossaryId}
                  className={classNames(
                    'tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-[7px] tw:border-0 tw:px-2.5 tw:py-2 tw:text-left tw:font-body tw:text-xs tw:leading-[normal] tw:font-medium',
                    selectedGlossaryId
                      ? 'tw:bg-white tw:text-gray-700 hover:tw:bg-gray-50'
                      : 'tw:bg-brand-50 tw:text-brand-700'
                  )}
                  role="menuitemradio"
                  type="button"
                  onClick={() => {
                    setSelectedGlossaryId(undefined);
                    setIsGlossaryMenuOpen(false);
                  }}>
                  <Globe01 aria-hidden="true" className="tw:size-[13px]" />
                  <span className="tw:min-w-0 tw:flex-1 tw:truncate">
                    {allGlossariesLabel}
                  </span>
                  <span className="tw:text-[10px] tw:leading-[normal] tw:font-medium tw:text-gray-400">
                    {glossaries.length}{' '}
                    {t('label.glossary-plural').toLocaleLowerCase()}
                  </span>
                </button>
                {glossaries.map((glossary) => {
                  const isSelected = glossary.id === selectedGlossaryId;

                  return (
                    <button
                      aria-checked={isSelected}
                      className={classNames(
                        'tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-[7px] tw:border-0 tw:px-2.5 tw:py-2 tw:text-left tw:font-body tw:text-xs tw:leading-[normal] tw:font-medium',
                        isSelected
                          ? 'tw:bg-brand-50 tw:text-brand-700'
                          : 'tw:bg-white tw:text-gray-700 hover:tw:bg-gray-50'
                      )}
                      key={glossary.id}
                      role="menuitemradio"
                      type="button"
                      onClick={() => {
                        setSelectedGlossaryId(glossary.id);
                        setIsGlossaryMenuOpen(false);
                      }}>
                      <Globe01 aria-hidden="true" className="tw:size-[13px]" />
                      <span className="tw:min-w-0 tw:flex-1 tw:truncate">
                        {glossary.displayName ?? glossary.name}
                      </span>
                      <span className="tw:text-[10px] tw:leading-[normal] tw:font-medium tw:text-gray-400">
                        {glossary.termCount ?? 0}{' '}
                        {t('label.term-plural').toLocaleLowerCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="tw:flex tw:min-w-0 tw:flex-1 tw:justify-center">
            <div className="tw:flex tw:gap-[3px] tw:rounded-[10px] tw:border tw:border-gray-200 tw:bg-gray-warm-100 tw:p-[3px]">
              {modeTabs.map((tab) => (
                <button
                  aria-pressed={mode === tab.id}
                  className={classNames(
                    MODE_TAB_CLASS,
                    mode === tab.id
                      ? 'tw:bg-white tw:text-brand-600 tw:shadow-[0_1px_2px_rgba(10,13,18,0.08)]'
                      : 'tw:bg-transparent tw:text-gray-500'
                  )}
                  data-testid={`mode-tab-${tab.id}`}
                  key={tab.id}
                  type="button"
                  onClick={() => setMode(tab.id as StudioMode)}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className={classNames(
              'tw:flex tw:shrink-0 tw:items-center tw:gap-1.5 tw:rounded-full tw:border',
              'tw:border-warning-200 tw:bg-warning-50 tw:px-[11px] tw:py-[5px] tw:font-body',
              'tw:text-[11px] tw:leading-[normal] tw:font-semibold tw:text-warning-700'
            )}>
            <span
              aria-hidden="true"
              className="tw:size-[7px] tw:rounded-full tw:bg-warning-500"
            />
            <span>{isolatedCount}</span>
            <span className="tw:lowercase">{t('label.isolated')}</span>
          </div>

          <span
            aria-label={userName}
            className="tw:grid tw:size-[30px] tw:shrink-0 tw:place-items-center tw:rounded-full tw:bg-brand-600 tw:font-body tw:text-[11px] tw:leading-[normal] tw:font-bold tw:text-white"
            role="img">
            {userInitials}
          </span>
        </header>

        <nav className="tw:flex tw:h-[46px] tw:shrink-0 tw:items-center tw:gap-2.5 tw:border-b tw:border-gray-blue-100 tw:bg-white tw:px-[18px]">
          <span className="tw:font-body tw:text-[11px] tw:leading-[normal] tw:font-semibold tw:tracking-[0.06em] tw:text-gray-400 tw:uppercase">
            {subModeLabel}
          </span>
          <div className="tw:flex tw:gap-0.5">
            {subModeItems.map((item) => (
              <button
                aria-pressed={subMode === item.id}
                className={classNames(
                  SUBMODE_TAB_CLASS,
                  subMode === item.id
                    ? 'tw:bg-white tw:text-brand-600 tw:shadow-[0_1px_2px_rgba(10,13,18,0.08)]'
                    : 'tw:bg-transparent tw:text-gray-500'
                )}
                data-testid={`submode-tab-${item.id}`}
                key={item.id}
                type="button"
                onClick={() => handleSubModeChange(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <span className="tw:flex-1" />
          <span
            className="tw:font-body tw:text-[11px] tw:leading-[normal] tw:font-medium tw:text-gray-500"
            data-testid="ontology-explorer-stats">
            {termCount} {t('label.term-plural').toLocaleLowerCase()}{' '}
            <span aria-hidden="true">·</span> {relationCount}{' '}
            {t('label.relation-plural').toLocaleLowerCase()}
          </span>
        </nav>

        <section
          className={classNames(
            'tw:flex tw:min-h-0 tw:flex-1',
            mode === 'query' ? 'tw:bg-gray-warm-100' : 'tw:bg-white'
          )}>
          {mode === 'query' ? (
            <div className="tw:min-h-0 tw:min-w-0 tw:flex-1 tw:overflow-auto">
              {querySurface === 'console' ? (
                <OntologyStudioQueryConsole
                  graphData={graphData}
                  relationTypes={relationTypes}
                  selectedGlossaryIds={selectedGlossaryIds}
                />
              ) : (
                <OntologyVisualQueryBuilder
                  graphData={graphData}
                  relationTypes={relationTypes}
                  selectedGlossaryIds={selectedGlossaryIds}
                />
              )}
            </div>
          ) : (
            <OntologyExplorer
              className="tw:min-h-0 tw:flex-1"
              globalGlossaryIds={selectedGlossaryIds}
              height="100%"
              isEditMode={mode === 'edit'}
              scope="global"
              showHealth={mode === 'view'}
              surface={mode === 'view' ? viewSurface : editSurface}
              onGlossariesChange={handleGlossariesChange}
              onGraphDataChange={handleGraphDataChange}
              onRelationTypesChange={handleRelationTypesChange}
              onRequestEdit={() => {
                setEditSurface('graph');
                setMode('edit');
              }}
              onStatsChange={handleStatsChange}
            />
          )}
        </section>
      </main>
    </PageLayoutV1>
  );
};

export default OntologyExplorerPage;
