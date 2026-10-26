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
  Checkbox,
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { Search, XClose } from '@openmetadata/ui-core-components/icons';
import { useQuery } from '@tanstack/react-query';
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
import { RelationshipType } from '../../../../generated/entity/data/relationshipType';
import { useOntologyStudioModel } from '../../../../hooks/governance/ontology/useOntologyStudioModel';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import {
  createOntologyAxiom,
  createOntologyProperty,
  createRelationshipType,
  listRelationshipTypes,
  patchOntologyProperty,
  patchRelationshipType,
} from '../../../../rest/ontologyAPI';
import {
  buildInverseBackLink,
  buildNativeRelationCatalog,
  buildNativeRelationGroups,
  findNativeRelationTypeByLabel,
  MAX_RELATIONSHIP_TYPE_PAGES,
  NativeRelationStep,
  NativeRelationType,
  planNativeRelation,
  planRelationshipType,
  RelationshipTypeDraft,
  toNativeRelationType,
} from '../../../../utils/governance/ontology/OntologyNativeRelation.utils';
import { listAllPages } from '../../../../utils/governance/ontology/OntologyPaging.utils';
import {
  buildDataPropertyRequest,
  DataPropertyInput,
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
  buildNativeTreeIndex,
  buildOntologyTreeMetrics,
  getOntologyHealthSummary,
} from '../../../OntologyExplorer/OntologyStudio.utils';
import OntologyTreeView from '../../../OntologyExplorer/OntologyTreeView';
import { NEW_RELATION_TYPE_PREFIX } from '../../../OntologyExplorer/RelationshipTypePicker.constants';
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
const RELATIONSHIP_TYPES_QUERY_KEY = 'relationship-types';
const NO_RELATIONSHIP_TYPES: RelationshipType[] = [];

const missingRelationType = (id: string): never => {
  throw new Error(`Unknown relation type ${id}`);
};

const writeStep = (step: NativeRelationStep) => {
  switch (step.kind) {
    case 'property':
      return createOntologyProperty(step.request);
    case 'link':
      return patchOntologyProperty(step.id, step.patch);
    case 'axiom':
      return createOntologyAxiom(step.request);
  }
};

const loadRegistry = () =>
  listAllPages(
    (after) => listRelationshipTypes({ limit: 1000, after }),
    MAX_RELATIONSHIP_TYPE_PAGES
  );

interface RelationshipTypeDialogProps {
  readonly label: string;
  readonly onCancel: () => void;
  readonly onSubmit: (draft: RelationshipTypeDraft) => void;
}

const RelationshipTypeDialog = ({
  label,
  onCancel,
  onSubmit,
}: RelationshipTypeDialogProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState(label);
  const [inverseName, setInverseName] = useState('');
  const [symmetric, setSymmetric] = useState(false);
  const [description, setDescription] = useState('');

  return (
    <ModalOverlay
      isDismissable
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel();
        }
      }}>
      <Modal>
        <Dialog
          aria-labelledby="relationship-type-dialog-title"
          width={480}
          onClose={onCancel}>
          <Box
            className="tw:p-5"
            data-testid="relationship-type-dialog"
            direction="col"
            gap={4}>
            <Typography
              id="relationship-type-dialog-title"
              role="heading"
              size="text-md"
              weight="bold">
              {t('label.add-entity', { entity: t('label.relationship-type') })}
            </Typography>
            <Input
              inputDataTestId="relationship-type-name"
              label={t('label.name')}
              size="sm"
              value={name}
              onChange={setName}
            />
            <Checkbox
              data-testid="relationship-type-symmetric"
              isSelected={symmetric}
              label={t('label.symmetric')}
              onChange={setSymmetric}
            />
            {symmetric ? (
              <Typography color="secondary" size="text-xs">
                {t('message.symmetric-relationship-type')}
              </Typography>
            ) : (
              <Input
                inputDataTestId="relationship-type-inverse"
                label={t('label.inverse-name')}
                size="sm"
                value={inverseName}
                onChange={setInverseName}
              />
            )}
            <Input
              inputDataTestId="relationship-type-description"
              label={t('label.description')}
              size="sm"
              value={description}
              onChange={setDescription}
            />
            <Box gap={2} justify="end">
              <Button
                color="secondary"
                data-testid="relationship-type-cancel"
                size="sm"
                onPress={onCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                data-testid="relationship-type-submit"
                isDisabled={name.trim().length === 0}
                size="sm"
                onPress={() =>
                  onSubmit({
                    description,
                    inverseLabel: inverseName,
                    label: name,
                    symmetric,
                  })
                }>
                {t('label.create')}
              </Button>
            </Box>
          </Box>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

interface OntologyGraphViewProps {
  readonly ontology: Ontology;
  readonly surface: 'graph' | 'tree';
  readonly onRequestGraphSurface: () => void;
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
  onRequestGraphSurface,
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
  const [typeDraft, setTypeDraft] = useState<{
    label: string;
    resolve: (draft?: RelationshipTypeDraft) => void;
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
  const treeIndex = useMemo(
    () => buildNativeTreeIndex(graph, { ...FILTERS, searchQuery: search }, []),
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
  const canCreateRelationType = [
    ResourceEntity.RELATIONSHIP_TYPE,
    ResourceEntity.ONTOLOGY_PROPERTY,
    ResourceEntity.ONTOLOGY_AXIOM,
  ].every(canCreateDefinition);
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
  const {
    data: relationTypes = NO_RELATIONSHIP_TYPES,
    error: registryError,
    refetch: refetchRegistry,
  } = useQuery({
    queryKey: [RELATIONSHIP_TYPES_QUERY_KEY],
    enabled: isEditing,
    gcTime: 30_000,
    staleTime: 30_000,
    retry: false,
    queryFn: loadRegistry,
  });
  const catalogOf = useCallback(
    (types: readonly RelationshipType[]) =>
      model
        ? buildNativeRelationCatalog(model, types, {
            subClassOf: t('label.is-a'),
          })
        : [],
    [model, t]
  );
  const catalog = useMemo(
    () => catalogOf(relationTypes),
    [catalogOf, relationTypes]
  );
  const relationTypeGroups = useMemo(
    () =>
      buildNativeRelationGroups(catalog, {
        core: t('label.core-owl-skos'),
        custom: t('label.custom-admin-defined'),
      }),
    [catalog, t]
  );

  const showWriteError = useCallback(
    (error: unknown) => {
      showErrorToast(
        isAxiosError(error) ? error : t('server.unexpected-error')
      );
    },
    [t]
  );

  useEffect(() => {
    if (registryError) {
      showWriteError(registryError);
    }
  }, [registryError, showWriteError]);

  const createType = useCallback(
    async (label: string): Promise<NativeRelationType | undefined> => {
      const existing = findNativeRelationTypeByLabel(catalog, label);
      if (existing || !canCreateRelationType) {
        return existing;
      }
      const draft = await new Promise<RelationshipTypeDraft | undefined>(
        (resolve) => setTypeDraft({ label: label.trim(), resolve })
      );
      setTypeDraft(undefined);
      if (!draft) {
        return undefined;
      }
      // The cached list is up to 30 s old. A type registered since then is reused as it is,
      // inverse included, and new names are chosen apart from everything the registry holds now.
      const registry = await loadRegistry();
      const registered = findNativeRelationTypeByLabel(
        catalogOf(registry),
        draft.label
      );
      if (registered) {
        void refetchRegistry();

        return registered;
      }
      const plan = planRelationshipType(draft, registry);
      const inverse = plan.inverse
        ? await createRelationshipType(plan.inverse)
        : undefined;
      const primary = await createRelationshipType(plan.primary);
      if (inverse) {
        await patchRelationshipType(inverse.id, buildInverseBackLink(primary));
      }
      void refetchRegistry();

      return toNativeRelationType(
        primary,
        inverse ? [primary, inverse] : [primary]
      );
    },
    [canCreateRelationType, catalog, catalogOf, refetchRegistry]
  );

  const createRelation = useCallback(
    async (
      fromId: string,
      toId: string,
      relationType: string
    ): Promise<boolean> => {
      if (!model || !canCreateAxiom) {
        return false;
      }
      const from = model.concepts.find((concept) => concept.id === fromId);
      const to = model.concepts.find((concept) => concept.id === toId);
      if (!from || !to) {
        showErrorToast(t('server.unexpected-error'));

        return false;
      }
      let written = false;
      try {
        const type = relationType.startsWith(NEW_RELATION_TYPE_PREFIX)
          ? await createType(
              relationType.slice(NEW_RELATION_TYPE_PREFIX.length)
            )
          : catalog.find((candidate) => candidate.id === relationType) ??
            missingRelationType(relationType);
        if (!type) {
          return false;
        }
        for (const step of planNativeRelation({ from, model, to, type })) {
          written = true;
          await writeStep(step);
          onWorkingChange?.();
        }

        return true;
      } catch (error) {
        showWriteError(error);

        return false;
      } finally {
        if (written) {
          await refetch();
        }
      }
    },
    [
      canCreateAxiom,
      catalog,
      createType,
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
          canCreateRelationType={canCreateRelationType}
          canEditBindings={isEditing && canEditConcept}
          concept={selected}
          isEditing={isEditing}
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
          onOpenData={() => {
            onRequestGraphSurface();
            setGraphMode('data');
          }}
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
          metrics={metrics}
          selectedNodeId={selectedId}
          source={{ kind: 'native', index: treeIndex }}
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
            canCreateRelationType={canCreateRelationType}
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
  const renderTypeDialog = () =>
    typeDraft ? (
      <RelationshipTypeDialog
        label={typeDraft.label}
        onCancel={() => typeDraft.resolve(undefined)}
        onSubmit={typeDraft.resolve}
      />
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
      {renderTypeDialog()}
    </div>
  );
};

export default OntologyGraphView;
