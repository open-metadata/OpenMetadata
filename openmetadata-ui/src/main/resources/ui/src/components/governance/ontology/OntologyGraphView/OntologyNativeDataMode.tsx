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
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useNativeOntologyDataGraph } from '../../../../hooks/governance/ontology/useNativeOntologyDataGraph';
import { getOntologyAssetPath } from '../../../../utils/governance/ontology/OntologyConceptBindings.utils';
import {
  buildNativeDataGraph,
  NATIVE_CONTEXT_CONCEPT_LIMIT,
} from '../../../../utils/governance/ontology/OntologyNativeDataGraph.utils';
import OntologyDataGraph from '../../../OntologyExplorer/OntologyDataGraph';
import { OntologyNode } from '../../../OntologyExplorer/OntologyExplorer.interface';

const NO_RELATION_TYPES: never[] = [];
const NO_COLORS: Record<string, never> = {};

interface OntologyNativeDataModeProps {
  isActive?: boolean;
  ontologyId: string;
  revision?: number;
  selectedConceptId?: string;
  onSelectConcept: (conceptId: string) => void;
}

const OntologyNativeDataMode = ({
  isActive,
  ontologyId,
  revision,
  selectedConceptId,
  onSelectConcept,
}: OntologyNativeDataModeProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    failure,
    graph,
    isLoading,
    isLoadingClusters,
    loadingConceptIds,
    loadMoreAssets,
    loadMoreClusters,
    retry,
  } = useNativeOntologyDataGraph(ontologyId, { isActive, revision });
  const data = useMemo(
    () => buildNativeDataGraph(graph, loadingConceptIds, t('label.lineage')),
    [graph, loadingConceptIds, t]
  );
  const selectNode = useCallback(
    (node: OntologyNode) => {
      if (node.type === 'ontologyConcept') {
        onSelectConcept(node.id);

        return;
      }
      const path = node.entityRef && getOntologyAssetPath(node.entityRef);
      if (path) {
        navigate(path);
      }
    },
    [navigate, onSelectConcept]
  );
  const hasMoreClusters =
    graph.nextClusterOffset !== undefined && !graph.contextFull;
  const hasClusters = graph.clusters.length > 0;
  // A reload keeps the graph mounted, so the selection and expanded cards stay.
  const showsGraph = hasClusters || !(isLoading || failure);

  return (
    <Box
      className="tw:relative tw:h-full tw:min-h-0 tw:flex-1"
      data-testid="ontology-native-data-graph"
      direction="col">
      <div
        aria-hidden="true"
        className={[
          'tw:pointer-events-none tw:absolute tw:inset-0 tw:bg-canvas tw:[background-size:22px_22px]',
          'tw:[background-image:radial-gradient(circle,var(--tw-border-color-secondary)_1px,transparent_1px)]',
        ].join(' ')}
      />
      {failure ? (
        <Alert
          className="tw:absolute tw:top-3.5 tw:left-1/2 tw:z-10 tw:-translate-x-1/2"
          data-testid="ontology-native-data-error"
          variant="error">
          {failure.reason === 'stale'
            ? t('message.ontology-data-graph-stale')
            : t('message.ontology-data-graph-unavailable')}
          <Button color="link-color" size="xs" onPress={retry}>
            {t('label.retry')}
          </Button>
        </Alert>
      ) : null}
      {isLoading ? (
        <Typography
          className={
            hasClusters
              ? 'tw:absolute tw:top-3.5 tw:right-4 tw:z-10'
              : 'tw:relative tw:p-4'
          }
          role="status">
          {t('label.loading')}
        </Typography>
      ) : null}
      {showsGraph ? (
        <OntologyDataGraph
          data={data}
          glossaryColorMap={NO_COLORS}
          hasMoreTerms={hasMoreClusters}
          isLoadingMoreTerms={isLoadingClusters}
          limitMessage={
            graph.contextFull
              ? t('message.ontology-data-context-full', {
                  count: NATIVE_CONTEXT_CONCEPT_LIMIT,
                })
              : undefined
          }
          relationTypes={NO_RELATION_TYPES}
          selectedNodeId={selectedConceptId}
          variant="native"
          onLoadMore={(node) => loadMoreAssets(node.id)}
          onLoadMoreTerms={loadMoreClusters}
          onPaneClick={() => undefined}
          onSelectNode={selectNode}
        />
      ) : null}
    </Box>
  );
};

export default OntologyNativeDataMode;
