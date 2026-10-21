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
  ButtonUtility,
  Card,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { Search, XClose } from '@openmetadata/ui-core-components/icons';
import { isAxiosError } from 'axios';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyProperty } from '../../../../generated/entity/data/ontologyProperty';
import { PaletteKey } from '../../../../generated/entity/data/relationshipType';
import { useOntologyStudioModel } from '../../../../hooks/governance/ontology/useOntologyStudioModel';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import {
  createOntologyAxiom,
  createOntologyProperty,
} from '../../../../rest/ontologyAPI';
import {
  buildDataPropertyRequest,
  buildObjectPropertyRequest,
  buildRestrictionAxiomRequest,
  buildSubClassAxiomRequest,
  DataPropertyInput,
  getObjectProperties,
  getPropertyLabel,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import OntologyControlButtons from '../../../OntologyExplorer/OntologyControlButtons';
import {
  LayoutType,
  RELATION_COLORS,
} from '../../../OntologyExplorer/OntologyExplorer.constants';
import { OntologyGraphHandle } from '../../../OntologyExplorer/OntologyExplorer.interface';
import OntologyHealthPanel from '../../../OntologyExplorer/OntologyHealthPanel';
import {
  buildOntologyTreeGroups,
  buildOntologyTreeMetrics,
  getOntologyHealthSummary,
} from '../../../OntologyExplorer/OntologyStudio.utils';
import OntologyTreeView from '../../../OntologyExplorer/OntologyTreeView';
import { NEW_RELATION_TYPE_PREFIX } from '../../../OntologyExplorer/RelationshipTypePicker.constants';
import { RelationTypeOptionGroup } from '../../../OntologyExplorer/RelationshipTypePicker.interface';
import { computeGraphSearchHighlight } from '../../../OntologyExplorer/utils/graphSearchHighlight';
import OntologyConceptEditor from '../OntologyConceptEditor/OntologyConceptEditor';
import OntologyConceptInspector from '../OntologyConceptInspector/OntologyConceptInspector';
import OntologyConceptDataGraph from '../OntologyGraphView/OntologyConceptDataGraph';

const OntologyGraphG6 = lazy(
  () => import('../../../OntologyExplorer/OntologyGraphG6')
);
const FILTERS = {
  glossaryIds: [],
  relationTypes: [],
  searchQuery: '',
  showCrossGlossaryOnly: false,
  showIsolatedNodes: true,
  viewMode: 'hierarchy' as const,
};
const SETTINGS = { layout: LayoutType.Hierarchical, showEdgeLabels: true };
const GRAPH_BACKDROP_CLASS =
  'tw:absolute tw:inset-0 tw:z-0 tw:bg-canvas tw:[background-image:radial-gradient(circle,var(--tw-border-color-secondary)_1px,transparent_1px)] tw:[background-size:22px_22px]';

interface OntologyGraphViewProps {
  readonly ontology: Ontology;
  readonly surface: 'graph' | 'tree';
  readonly createConceptRequestKey?: number;
  readonly isEditing?: boolean;
  readonly selectedConceptId?: string;
  readonly onSelectedConceptChange?: (id?: string) => void;
  readonly onRequestEdit?: () => void;
  readonly onStatsChange?: (stats: OntologyModelStats) => void;
  readonly onWorkingChange?: () => void;
}

export interface OntologyModelStats {
  readonly conceptCount: number;
  readonly isolatedCount: number;
  readonly ontologyId: string;
  readonly relationCount: number;
}

interface ConceptEditorRequest {
  readonly conceptId?: string;
}

const OntologyGraphView = ({
  ontology,
  surface,
  createConceptRequestKey = 0,
  isEditing = false,
  selectedConceptId,
  onSelectedConceptChange,
  onRequestEdit,
  onStatsChange,
  onWorkingChange,
}: OntologyGraphViewProps) => {
  const { t } = useTranslation();
  const graphRef = useRef<OntologyGraphHandle>(null);
  const pendingRelationProperty = useRef<{
    key: string;
    property: OntologyProperty;
  }>();
  const handledCreateConceptRequest = useRef(createConceptRequestKey);
  const [search, setSearch] = useState('');
  const [graphMode, setGraphMode] = useState<'model' | 'data'>('model');
  const [localSelectedId, setLocalSelectedId] = useState<string>();
  const selectedId = onSelectedConceptChange
    ? selectedConceptId
    : localSelectedId;
  const setSelectedId = onSelectedConceptChange ?? setLocalSelectedId;
  const [conceptEditor, setConceptEditor] = useState<ConceptEditorRequest>();
  const { graph, isError, isFetching, isLoading, model, refetch, relations } =
    useOntologyStudioModel(ontology);
  const groups = useMemo(
    () =>
      buildOntologyTreeGroups(
        graph,
        { ...FILTERS, searchQuery: search },
        [],
        []
      ),
    [graph, search]
  );
  const metrics = useMemo(
    () => buildOntologyTreeMetrics(graph, { ...FILTERS, searchQuery: search }),
    [graph, search]
  );
  const health = useMemo(
    () => getOntologyHealthSummary(graph, FILTERS),
    [graph]
  );
  const searchHighlight = useMemo(
    () =>
      graph
        ? computeGraphSearchHighlight(graph.nodes, graph.edges, search, [], [])
        : null,
    [graph, search]
  );
  const relationColors = useMemo(
    () =>
      graph
        ? Object.fromEntries(
            graph.edges.map((edge) => [
              edge.relationType,
              RELATION_COLORS[edge.relationType] ?? RELATION_COLORS.isA,
            ])
          )
        : {},
    [graph]
  );
  const { permissions } = usePermissionProvider();
  const canCreateDefinition = (resource: ResourceEntity) =>
    isEditing &&
    !ontology.deleted &&
    getDerivedPermissionFlags(
      permissions[resource] ?? DEFAULT_ENTITY_PERMISSION
    ).canCreate;
  const canCreateConcept = canCreateDefinition(ResourceEntity.ONTOLOGY_CONCEPT);
  const canCreateProperty = canCreateDefinition(
    ResourceEntity.ONTOLOGY_PROPERTY
  );
  const canCreateAxiom = canCreateDefinition(ResourceEntity.ONTOLOGY_AXIOM);
  const conceptPermissionId = conceptEditor?.conceptId ?? selectedId;
  const { canEditAll: canEditConcept } = useEntityPermissions(
    ResourceEntity.ONTOLOGY_CONCEPT,
    { id: conceptPermissionId ?? '' },
    {
      enabled: Boolean(conceptPermissionId),
      deleted: model?.concepts.find(
        (concept) => concept.id === conceptPermissionId
      )?.deleted,
    }
  );
  const selected = model?.concepts.find((concept) => concept.id === selectedId);
  const relationTypeGroups = useMemo<RelationTypeOptionGroup[]>(
    () =>
      model
        ? [
            {
              id: 'hierarchy',
              options: [
                {
                  id: 'isA',
                  label: t('label.is-a'),
                  paletteKey: PaletteKey.Purple,
                },
              ],
              title: t('label.hierarchy'),
            },
            {
              id: 'properties',
              options: getObjectProperties(model).map((property) => ({
                id: property.iri,
                label: getPropertyLabel(property),
                paletteKey: PaletteKey.Blue,
              })),
              title: t('label.relationship-plural'),
            },
          ]
        : [],
    [model, t]
  );

  const showWriteError = useCallback(
    (error: unknown) => {
      showErrorToast(
        isAxiosError(error) ? error : t('server.unexpected-error')
      );
    },
    [t]
  );

  const createRelation = useCallback(
    async (
      fromId: string,
      toId: string,
      relationType: string
    ): Promise<boolean> => {
      if (
        !model ||
        !canCreateAxiom ||
        (relationType.startsWith(NEW_RELATION_TYPE_PREFIX) &&
          !canCreateProperty)
      ) {
        return false;
      }
      const from = model.concepts.find((concept) => concept.id === fromId);
      const to = model.concepts.find((concept) => concept.id === toId);
      if (!from || !to) {
        showErrorToast(t('server.unexpected-error'));

        return false;
      }
      const pendingKey = `${fromId}|${toId}|${relationType}`;
      const getOrCreateRelationProperty = async () => {
        if (!relationType.startsWith(NEW_RELATION_TYPE_PREFIX)) {
          const property = model.properties.find(
            (candidate) => candidate.iri === relationType
          );
          if (!property) {
            throw new Error('Missing ontology relationship property');
          }

          return property;
        }
        if (pendingRelationProperty.current?.key === pendingKey) {
          return pendingRelationProperty.current.property;
        }
        const created = await createOntologyProperty(
          buildObjectPropertyRequest(
            model,
            relationType.slice(NEW_RELATION_TYPE_PREFIX.length),
            from,
            to
          )
        );
        pendingRelationProperty.current = {
          key: pendingKey,
          property: created,
        };
        onWorkingChange?.();

        return created;
      };

      try {
        if (relationType === 'isA') {
          await createOntologyAxiom(
            buildSubClassAxiomRequest({
              from,
              model,
              statement: `${from.name} is a ${to.name}`,
              to,
            })
          );
        } else {
          const property = await getOrCreateRelationProperty();
          await createOntologyAxiom(
            buildRestrictionAxiomRequest({
              from,
              model,
              property,
              statement: `${from.name} ${getPropertyLabel(property)} ${
                to.name
              }`,
              to,
            })
          );
        }
        if (pendingRelationProperty.current?.key === pendingKey) {
          pendingRelationProperty.current = undefined;
        }
        onWorkingChange?.();
        await refetch();

        return true;
      } catch (error) {
        showWriteError(error);

        return false;
      }
    },
    [
      canCreateAxiom,
      canCreateProperty,
      model,
      onWorkingChange,
      refetch,
      showWriteError,
      t,
    ]
  );

  const createDataProperty = useCallback(
    async (conceptId: string, input: DataPropertyInput): Promise<boolean> => {
      const concept = model?.concepts.find((item) => item.id === conceptId);
      if (!model || !concept || !canCreateProperty) {
        return false;
      }
      try {
        await createOntologyProperty(
          buildDataPropertyRequest(model, concept, input)
        );
        onWorkingChange?.();
        await refetch();

        return true;
      } catch (error) {
        showWriteError(error);

        return false;
      }
    },
    [canCreateProperty, model, onWorkingChange, refetch, showWriteError]
  );

  useEffect(() => {
    if (model) {
      onStatsChange?.({
        conceptCount: model.concepts.length,
        isolatedCount: health.isolatedTerms.length,
        ontologyId: ontology.id,
        relationCount: relations.length,
      });
    }
  }, [
    health.isolatedTerms.length,
    model,
    onStatsChange,
    ontology.id,
    relations.length,
  ]);

  useEffect(() => {
    if (
      isEditing &&
      createConceptRequestKey > 0 &&
      handledCreateConceptRequest.current !== createConceptRequestKey
    ) {
      handledCreateConceptRequest.current = createConceptRequestKey;
      setSelectedId(undefined);
      setConceptEditor({});
    }
  }, [createConceptRequestKey, isEditing, setSelectedId]);

  if (isError) {
    return (
      <Alert variant="error">
        {t('server.entity-fetch-error', { entity: t('label.ontology') })}
        <Button color="secondary" onPress={() => void refetch()}>
          {t('label.retry')}
        </Button>
      </Alert>
    );
  }
  if (isLoading || !model || !graph) {
    return <Typography role="status">{t('label.loading')}</Typography>;
  }

  const selectNode = ({ id }: { id: string }) => setSelectedId(id);
  const connectNode = ({ id }: { id: string }) => {
    setSelectedId(id);
    onRequestEdit?.();
  };

  const renderConceptEditor = () => {
    const editingConcept = model.concepts.find(
      (concept) => concept.id === conceptEditor?.conceptId
    );

    return (
      <aside
        className="tw:flex tw:h-full tw:w-75 tw:shrink-0 tw:flex-col tw:overflow-hidden tw:border-l tw:border-secondary tw:bg-surface"
        data-testid="ontology-concept-authoring">
        <Box
          align="center"
          className="tw:shrink-0 tw:border-b tw:border-secondary tw:px-4 tw:py-3"
          gap={2}>
          <Typography className="tw:flex-1" size="text-sm" weight="semibold">
            {editingConcept
              ? t('label.edit-entity', { entity: t('label.concept') })
              : t('label.add-entity', { entity: t('label.concept') })}
          </Typography>
          <ButtonUtility
            color="tertiary"
            data-testid="ontology-concept-authoring-close"
            icon={XClose}
            size="sm"
            tooltip={t('label.close')}
            onClick={() => setConceptEditor(undefined)}
          />
        </Box>
        <div className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-5">
          <OntologyConceptEditor
            canEdit={editingConcept ? canEditConcept : canCreateConcept}
            concept={editingConcept}
            key={editingConcept?.id ?? 'new'}
            ontology={ontology}
            onSaved={(saved) => {
              setSelectedId(saved.id);
              setConceptEditor(undefined);
              onWorkingChange?.();
              void refetch();
            }}
          />
        </div>
      </aside>
    );
  };

  const renderSidebar = () => {
    if (conceptEditor && isEditing) {
      return renderConceptEditor();
    }

    if (selected) {
      return (
        <OntologyConceptInspector
          canAddProperty={canCreateProperty}
          canAddRelation={canCreateAxiom}
          canCreateRelationType={canCreateProperty}
          canEditBindings={isEditing && canEditConcept}
          concept={selected}
          model={model}
          relationTypeGroups={relationTypeGroups}
          relations={relations}
          onAddProperty={(input) => createDataProperty(selected.id, input)}
          onAddRelation={(targetId, relationType) =>
            createRelation(selected.id, targetId, relationType)
          }
          onClose={() => setSelectedId(undefined)}
          onEdit={
            canEditConcept
              ? () => {
                  setConceptEditor({ conceptId: selected.id });
                  onRequestEdit?.();
                }
              : undefined
          }
          onEditMappings={
            isEditing && canEditConcept
              ? () => setConceptEditor({ conceptId: selected.id })
              : undefined
          }
          onSelectConcept={(concept) => setSelectedId(concept.id)}
        />
      );
    }

    return (
      <OntologyHealthPanel
        health={health}
        placement="sidebar"
        onConnect={connectNode}
      />
    );
  };

  const renderSurface = () => {
    if (surface === 'tree') {
      return (
        <OntologyTreeView
          density="compact"
          emptyMessage={t('label.no-entity-found', {
            entity: t('label.concept-plural'),
          })}
          groups={groups}
          metrics={metrics}
          selectedNodeId={selectedId}
          onConnect={connectNode}
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
      <>
        <div aria-hidden="true" className={GRAPH_BACKDROP_CLASS} />
        <Suspense
          fallback={
            <Typography role="status">{t('label.loading')}</Typography>
          }>
          <OntologyGraphG6
            studioMode
            canCreateRelationType={canCreateProperty}
            edges={graph.edges}
            glossaries={[]}
            glossaryColorMap={{}}
            graphSearchHighlight={searchHighlight}
            isEditMode={canCreateAxiom}
            nodes={graph.nodes}
            ref={graphRef}
            relationColors={relationColors}
            relationTypeGroups={relationTypeGroups}
            selectedNodeId={selectedId}
            settings={SETTINGS}
            onCreateRelation={async (fromId, toId, relationType) => {
              await createRelation(fromId, toId, relationType);
            }}
            onNodeClick={selectNode}
            onNodeDoubleClick={selectNode}
            onPaneClick={() => setSelectedId(undefined)}
          />
        </Suspense>
        <Card
          className="tw:absolute tw:bottom-4 tw:left-4 tw:z-6 tw:flex tw:items-center tw:rounded-lg"
          data-testid="ontology-graph-controls"
          variant="elevated">
          <OntologyControlButtons
            isLoading={isFetching}
            onFitToScreen={() => void graphRef.current?.fitView()}
            onRefresh={() => void refetch()}
            onZoomIn={() => graphRef.current?.zoomIn()}
            onZoomOut={() => graphRef.current?.zoomOut()}
          />
        </Card>
      </>
    );
  };

  const renderGraphMode = () =>
    surface === 'graph' ? (
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
    ) : null;

  return (
    <div className="tw:flex tw:h-full tw:min-h-0 tw:w-full tw:overflow-hidden">
      <div className="tw:relative tw:isolate tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-col tw:overflow-hidden">
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
            placeholder={`${t('label.find-concept')}…`}
            size="sm"
            value={search}
            onChange={setSearch}
          />
        </div>
        {renderGraphMode()}
        {renderSurface()}
      </div>
      {renderSidebar()}
    </div>
  );
};

export default OntologyGraphView;
