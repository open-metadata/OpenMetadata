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

import {
  Box,
  Button,
  Card,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { Search } from '@openmetadata/ui-core-components/icons';
import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import {
  getModelRelations,
  OntologyStudioModel,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import OntologyControlButtons from '../../../OntologyExplorer/OntologyControlButtons';
import {
  OntologyGraphData,
  OntologyGraphHandle,
  OntologyNode,
} from '../../../OntologyExplorer/OntologyExplorer.interface';
import OntologyHealthPanel from '../../../OntologyExplorer/OntologyHealthPanel';
import {
  buildNativeTreeIndex,
  getOntologyHealthSummary,
} from '../../../OntologyExplorer/OntologyStudio.utils';
import OntologyTreeView from '../../../OntologyExplorer/OntologyTreeView';
import { computeGraphSearchHighlight } from '../../../OntologyExplorer/utils/graphSearchHighlight';
import OntologyConceptInspector from '../OntologyConceptInspector/OntologyConceptInspector';
import OntologyConceptDataGraph from '../OntologyGraphView/OntologyConceptDataGraph';
import {
  EMPTY_COLOR_MAP,
  EMPTY_GLOSSARIES,
  FILTERS,
  SETTINGS,
} from './AllOntologiesGraphView.constants';
const OntologyGraphG6 = lazy(
  () => import('../../../OntologyExplorer/OntologyGraphG6')
);

interface AllOntologiesGraphViewProps {
  readonly graph: OntologyGraphData;
  readonly models: OntologyStudioModel[];
  readonly selectedConceptId?: string;
  readonly surface: 'graph' | 'tree';
  readonly onRequestGraphSurface: () => void;
  readonly isFetching: boolean;
  readonly onRefresh: () => void;
  readonly onEditConcept: (ontology: Ontology, conceptId: string) => void;
  readonly onSelectedConceptChange: (conceptId?: string) => void;
}

const AllOntologiesGraphView = ({
  graph,
  models,
  selectedConceptId,
  surface,
  onRequestGraphSurface,
  isFetching,
  onRefresh,
  onEditConcept,
  onSelectedConceptChange,
}: AllOntologiesGraphViewProps) => {
  const { t } = useTranslation();
  const graphRef = useRef<OntologyGraphHandle>(null);
  const [search, setSearch] = useState('');
  const [graphMode, setGraphMode] = useState<'model' | 'data'>('model');
  const model = models.find((candidate) =>
    candidate.concepts.some((concept) => concept.id === selectedConceptId)
  );
  const selected = model?.concepts.find(
    (concept) => concept.id === selectedConceptId
  );
  const relations = useMemo(
    () => (model ? getModelRelations(model) : []),
    [model]
  );
  const { canEditAll } = useEntityPermissions(
    ResourceEntity.ONTOLOGY_CONCEPT,
    { id: selected?.id ?? '' },
    { enabled: Boolean(selected), deleted: selected?.deleted }
  );
  const treeIndex = useMemo(
    () => buildNativeTreeIndex(graph, { ...FILTERS, searchQuery: search }, []),
    [graph, search]
  );
  const highlight = useMemo(
    () => computeGraphSearchHighlight(graph.nodes, graph.edges, search, [], []),
    [graph, search]
  );
  const health = useMemo(
    () => getOntologyHealthSummary(graph, FILTERS),
    [graph]
  );
  const openOwner = (node: OntologyNode) => {
    const ontology = models.find(
      (item) => item.ontology.id === node.glossaryId
    )?.ontology;
    if (ontology) {
      onEditConcept(ontology, node.id);
    }
  };
  const selectNode = (node: { id: string }) => onSelectedConceptChange(node.id);

  const renderSurface = () => {
    if (surface === 'tree') {
      return (
        <OntologyTreeView
          density="compact"
          selectedNodeId={selectedConceptId}
          source={{ kind: 'native', index: treeIndex }}
          onSelect={selectNode}
        />
      );
    }
    if (graphMode === 'data') {
      return (
        <OntologyConceptDataGraph
          concept={selected}
          key={selected?.id}
          model={model}
        />
      );
    }

    return (
      <Suspense
        fallback={<Typography role="status">{t('label.loading')}</Typography>}>
        <OntologyGraphG6
          studioMode
          edges={graph.edges}
          glossaries={EMPTY_GLOSSARIES}
          glossaryColorMap={EMPTY_COLOR_MAP}
          graphSearchHighlight={highlight}
          nodes={graph.nodes}
          ref={graphRef}
          selectedNodeId={selectedConceptId}
          settings={SETTINGS}
          onNodeClick={selectNode}
          onNodeDoubleClick={selectNode}
          onPaneClick={() => onSelectedConceptChange(undefined)}
        />
        <Card
          className="tw:absolute tw:bottom-4 tw:left-4 tw:z-6"
          variant="elevated">
          <OntologyControlButtons
            isLoading={isFetching}
            onFitToScreen={() => void graphRef.current?.fitView()}
            onRefresh={onRefresh}
            onZoomIn={() => graphRef.current?.zoomIn()}
            onZoomOut={() => graphRef.current?.zoomOut()}
          />
        </Card>
      </Suspense>
    );
  };

  return (
    <Box
      className="tw:h-full tw:min-h-0 tw:w-full"
      data-testid="all-ontologies-graph"
      direction="row">
      <div className="tw:relative tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-col tw:overflow-hidden tw:bg-canvas">
        {surface === 'graph' ? (
          <div
            aria-hidden="true"
            className="tw:pointer-events-none tw:absolute tw:inset-0 tw:[background-image:radial-gradient(circle,var(--tw-border-color-secondary)_1px,transparent_1px)] tw:[background-size:22px_22px]"
          />
        ) : null}
        <div
          className={
            surface === 'tree'
              ? 'tw:px-6 tw:pt-4'
              : 'tw:absolute tw:left-3.5 tw:top-3.5 tw:z-6'
          }>
          <Input
            aria-label={t('label.find-concept')}
            className="tw:w-54"
            icon={Search}
            inputDataTestId="ontology-graph-search"
            placeholder={t('label.find-concept')}
            size="sm"
            value={search}
            onChange={setSearch}
          />
        </div>
        {surface === 'graph' ? (
          <Box
            className="tw:absolute tw:top-3.5 tw:right-4 tw:z-10 tw:rounded-lg tw:border tw:border-secondary tw:bg-surface tw:p-1"
            gap={1}>
            {(['model', 'data'] as const).map((mode) => (
              <Button
                aria-pressed={graphMode === mode}
                color={graphMode === mode ? 'primary' : 'tertiary'}
                data-testid={`ontology-graph-mode-${mode}`}
                key={mode}
                size="xs"
                onPress={() => setGraphMode(mode)}>
                {t(`label.${mode}`)}
              </Button>
            ))}
          </Box>
        ) : null}
        {renderSurface()}
      </div>
      {selected && model ? (
        <OntologyConceptInspector
          concept={selected}
          model={model}
          relations={relations}
          onClose={() => onSelectedConceptChange(undefined)}
          onEdit={
            canEditAll
              ? () => onEditConcept(model.ontology, selected.id)
              : undefined
          }
          onOpenData={() => {
            onRequestGraphSurface();
            setGraphMode('data');
          }}
          onSelectConcept={selectNode}
        />
      ) : (
        <OntologyHealthPanel
          health={health}
          placement="sidebar"
          onConnect={openOwner}
        />
      )}
    </Box>
  );
};

export default AllOntologiesGraphView;
