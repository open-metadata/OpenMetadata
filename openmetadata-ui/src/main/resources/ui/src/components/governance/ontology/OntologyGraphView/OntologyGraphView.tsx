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
  Alert,
  Box,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import { useInfiniteQuery } from '@tanstack/react-query';
import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { listOntologyConcepts } from '../../../../rest/ontologyAPI';
import { buildNativeOntologyGraph } from '../../../../utils/governance/ontology/OntologyGraph.utils';
import OntologyControlButtons from '../../../OntologyExplorer/OntologyControlButtons';
import { LayoutType } from '../../../OntologyExplorer/OntologyExplorer.constants';
import { OntologyGraphHandle } from '../../../OntologyExplorer/OntologyExplorer.interface';
import { buildOntologyTreeGroups } from '../../../OntologyExplorer/OntologyStudio.utils';
import OntologyTreeView from '../../../OntologyExplorer/OntologyTreeView';
import OntologyConceptEditor from '../OntologyConceptEditor/OntologyConceptEditor';

const OntologyGraphG6 = lazy(
  () => import('../../../OntologyExplorer/OntologyGraphG6')
);
const GRAPH_LIMIT = 10000;
const FILTERS = {
  viewMode: 'hierarchy' as const,
  glossaryIds: [],
  relationTypes: [],
  searchQuery: '',
  showIsolatedNodes: true,
  showCrossGlossaryOnly: false,
};
const SETTINGS = { layout: LayoutType.Hierarchical, showEdgeLabels: true };

const OntologyGraphView = ({ ontology }: { ontology: Ontology }) => {
  const { t } = useTranslation();
  const graphRef = useRef<OntologyGraphHandle>(null);
  const [surface, setSurface] = useState<'graph' | 'tree'>('graph');
  const [selectedId, setSelectedId] = useState<string>();
  const query = useInfiniteQuery({
    queryKey: ['ontology-studio-concepts', ontology.id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      listOntologyConcepts(
        {
          ontology: ontology.fullyQualifiedName,
          fields: 'superClasses',
          limit: 500,
          after: pageParam,
        },
        signal
      ),
    getNextPageParam: (page) => page.paging.after,
    retry: false,
    gcTime: 0,
  });
  const concepts = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data]
  );
  const graph = useMemo(
    () => buildNativeOntologyGraph(ontology, concepts),
    [ontology, concepts]
  );
  const groups = useMemo(
    () => buildOntologyTreeGroups(graph, FILTERS, [], []),
    [graph]
  );
  const selected = concepts.find((concept) => concept.id === selectedId);
  if (query.isError) {
    return (
      <Alert variant="error">
        {t('server.entity-fetch-error', { entity: t('label.concept-plural') })}
        <Button color="secondary" onPress={() => void query.refetch()}>
          {t('label.retry')}
        </Button>
      </Alert>
    );
  }
  if (query.isPending) {
    return <Typography role="status">{t('label.loading')}</Typography>;
  }

  return (
    <Box className="tw:h-full tw:w-full" direction="col" gap={3}>
      <Box align="center" className="tw:px-6 tw:pt-4" gap={3}>
        {(['graph', 'tree'] as const).map((view) => (
          <Button
            aria-pressed={surface === view}
            color="secondary"
            data-testid={`submode-tab-${view}`}
            key={view}
            onPress={() => setSurface(view)}>
            {t(`label.${view}`)}
          </Button>
        ))}
        <Typography>
          {concepts.length} / {query.data.pages[0].paging.total}{' '}
          {t('label.concept-plural')}
        </Typography>
        {query.hasNextPage && (
          <Button
            color="secondary"
            isDisabled={query.isFetching || concepts.length >= GRAPH_LIMIT}
            onPress={() => void query.fetchNextPage()}>
            {t('label.load-more')}
          </Button>
        )}
        <OntologyControlButtons
          isLoading={query.isFetching}
          onFitToScreen={() => void graphRef.current?.fitView()}
          onRefresh={() => void query.refetch()}
          onZoomIn={() => graphRef.current?.zoomIn()}
          onZoomOut={() => graphRef.current?.zoomOut()}
        />
      </Box>
      {query.hasNextPage && concepts.length >= GRAPH_LIMIT && (
        <Alert variant="warning">
          {t('message.ontology-graph-limit', { count: GRAPH_LIMIT })}
        </Alert>
      )}
      <Box className="tw:min-h-0 tw:flex-1" gap={4}>
        <Box className="tw:min-h-96 tw:min-w-0 tw:flex-1">
          {surface === 'tree' ? (
            <OntologyTreeView
              groups={groups}
              selectedNodeId={selectedId}
              onSelect={(node) => setSelectedId(node.id)}
            />
          ) : (
            <Suspense
              fallback={
                <Typography role="status">{t('label.loading')}</Typography>
              }>
              <OntologyGraphG6
                edges={graph.edges}
                glossaries={[]}
                glossaryColorMap={{}}
                nodes={graph.nodes}
                ref={graphRef}
                selectedNodeId={selectedId}
                settings={SETTINGS}
                onNodeClick={(node) => setSelectedId(node.id)}
                onNodeDoubleClick={(node) => setSelectedId(node.id)}
                onPaneClick={() => setSelectedId(undefined)}
              />
            </Suspense>
          )}
        </Box>
        {selected && (
          <Box
            className="tw:w-96 tw:shrink-0 tw:overflow-auto tw:p-4"
            direction="col"
            gap={3}>
            <Button color="secondary" onPress={() => setSelectedId(undefined)}>
              {t('label.close')}
            </Button>
            <OntologyConceptEditor
              canEdit={false}
              concept={selected}
              key={selected.id}
              ontology={ontology}
              onSaved={() => void query.refetch()}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default OntologyGraphView;
