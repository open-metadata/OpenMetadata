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
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { lazy, Suspense, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import { useOntologyConceptBindings } from '../../../../hooks/governance/ontology/useOntologyConceptBindings';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  buildOntologyBindingGraph,
  getOntologyAssetPath,
} from '../../../../utils/governance/ontology/OntologyConceptBindings.utils';
import { OntologyStudioModel } from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import OntologyControlButtons from '../../../OntologyExplorer/OntologyControlButtons';
import { LayoutType } from '../../../OntologyExplorer/OntologyExplorer.constants';
import {
  OntologyGraphHandle,
  OntologyNode,
} from '../../../OntologyExplorer/OntologyExplorer.interface';

const OntologyGraphG6 = lazy(
  () => import('../../../OntologyExplorer/OntologyGraphG6')
);
const SETTINGS = { layout: LayoutType.Hierarchical, showEdgeLabels: true };

interface OntologyConceptDataGraphProps {
  model?: OntologyStudioModel;
  concept?: OntologyConcept;
}

const OntologyConceptDataGraph = ({
  model,
  concept,
}: OntologyConceptDataGraphProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const graphRef = useRef<OntologyGraphHandle>(null);
  const bindings = useOntologyConceptBindings(concept?.id);
  const graph = useMemo(
    () =>
      model && concept && bindings.data
        ? buildOntologyBindingGraph(
            model,
            concept,
            bindings.data,
            t('label.linked-asset-plural'),
            t('label.unavailable')
          )
        : { nodes: [], edges: [] },
    [model, concept, bindings.data, t]
  );
  const openAsset = (node: OntologyNode) => {
    const path = node.entityRef && getOntologyAssetPath(node.entityRef);
    if (path) {
      navigate(path);
    }
  };

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
      <Box
        className="tw:absolute tw:top-15 tw:left-4 tw:z-6 tw:max-w-md tw:rounded-lg tw:bg-surface tw:p-3"
        direction="col"
        gap={1}>
        <Typography size="text-sm" weight="semibold">
          {concept
            ? t('label.ontology-data-for-concept', {
                name: getEntityName(concept),
              })
            : t('label.select-entity', { entity: t('label.concept') })}
        </Typography>
        <Typography color="secondary" size="text-xs">
          {t('message.ontology-data-graph-scope')}
        </Typography>
        {concept && bindings.isPending ? (
          <Typography role="status">{t('label.loading')}</Typography>
        ) : null}
        {bindings.readState === 'unavailable' ? (
          <Alert variant="error">
            {t('message.ontology-binding-read-unavailable')}
            <Button
              color="link-color"
              size="xs"
              onPress={() => void bindings.retryRead().catch(() => undefined)}>
              {t('label.retry')}
            </Button>
          </Alert>
        ) : null}
        {bindings.isSuccess && bindings.data?.assets.length === 0 ? (
          <Typography size="text-xs">
            {t('message.no-data-available')}
          </Typography>
        ) : null}
      </Box>
      <Suspense
        fallback={<Typography role="status">{t('label.loading')}</Typography>}>
        <OntologyGraphG6
          studioMode
          edges={graph.edges}
          explorationMode="data"
          glossaries={[]}
          glossaryColorMap={{}}
          nodes={graph.nodes}
          ref={graphRef}
          selectedNodeId={concept?.id}
          settings={SETTINGS}
          onNodeClick={openAsset}
          onNodeDoubleClick={openAsset}
          onPaneClick={() => undefined}
        />
      </Suspense>
      <Card
        className="tw:absolute tw:bottom-4 tw:left-4 tw:z-6"
        variant="elevated">
        <OntologyControlButtons
          isLoading={bindings.isFetching}
          onFitToScreen={() => void graphRef.current?.fitView()}
          onRefresh={() => void bindings.retryRead().catch(() => undefined)}
          onZoomIn={() => graphRef.current?.zoomIn()}
          onZoomOut={() => graphRef.current?.zoomOut()}
        />
      </Card>
    </Box>
  );
};

export default OntologyConceptDataGraph;
