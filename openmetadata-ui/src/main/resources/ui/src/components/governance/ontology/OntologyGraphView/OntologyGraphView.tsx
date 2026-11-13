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
  Checkbox,
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  ComponentProps,
  KeyboardEvent,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { OntologyDraftContext } from '../../../../context/OntologyDraft/OntologyDraftContext';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { OntologyProfileViolation } from '../../../../generated/api/data/ontologyProfileReport';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import {
  PaletteKey,
  RelationshipType,
} from '../../../../generated/entity/data/relationshipType';
import { useOntologyDraftGuard } from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import {
  useOntologyStudioModel,
  WORKING_CONCEPT_FIELDS,
} from '../../../../hooks/governance/ontology/useOntologyStudioModel';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { useBulkEntityPermissions } from '../../../../hooks/useEntityPermissions/useBulkEntityPermissions';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import {
  createOntologyAxiom,
  createOntologyProperty,
  createRelationshipType,
  getOntologyConcept,
  getOntologyWorkingValidation,
  listRelationshipTypes,
  patchOntologyAxiom,
  patchOntologyProperty,
  patchRelationshipType,
  restoreOntologyDefinition,
  softDeleteOntologyDefinition,
} from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  buildInverseBackLink,
  buildNativeRelationCatalog,
  buildNativeRelationGroups,
  buildObjectPropertyRequest,
  ConceptPropertyInput,
  findNativeRelationTypeByLabel,
  findNativeRelationTypeByPhrase,
  MAX_RELATIONSHIP_TYPE_PAGES,
  NativeRelationStep,
  NativeRelationType,
  planNativeProperties,
  planNativeRelation,
  planRelationshipType,
  RelationshipTypeDraft,
  RelationshipTypePlan,
  toNativeRelationType,
} from '../../../../utils/governance/ontology/OntologyNativeRelation.utils';
import { listAllPages } from '../../../../utils/governance/ontology/OntologyPaging.utils';
import {
  checkNativeRelation,
  describeRelationIssue,
} from '../../../../utils/governance/ontology/OntologyRelationCheck.utils';
import { findRelationClash } from '../../../../utils/governance/ontology/OntologyRelationClash.utils';
import {
  buildDataPropertyRequest,
  buildOntologyStudioGraph,
  buildReusePropertyPatch,
  getBindableConceptProperties,
  OntologyModelRelation,
  OntologyStudioModel,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import { showUndoToast } from '../../../../utils/governance/ontology/OntologyUndoToast';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import Loader from '../../../common/Loader/Loader';
import OntologyControlButtons from '../../../OntologyExplorer/OntologyControlButtons';
import {
  LayoutType,
  RELATION_COLORS,
} from '../../../OntologyExplorer/OntologyExplorer.constants';
import {
  OntologyGraphData,
  OntologyGraphHandle,
} from '../../../OntologyExplorer/OntologyExplorer.interface';
import OntologyHealthPanel from '../../../OntologyExplorer/OntologyHealthPanel';
import {
  buildNativeTreeIndex,
  buildOntologyTreeMetrics,
  getOntologyHealthSummary,
} from '../../../OntologyExplorer/OntologyStudio.utils';
import OntologyTreeView from '../../../OntologyExplorer/OntologyTreeView';
import { NEW_RELATION_TYPE_PREFIX } from '../../../OntologyExplorer/RelationshipTypePicker.constants';
import {
  RelationWarningCheck,
  RelationWarningContext,
} from '../../../OntologyExplorer/RelationWarning.context';
import { rankConceptMatches } from '../../../OntologyExplorer/utils/conceptSearch';
import {
  buildConflictHighlight,
  toReadableViolationMessage,
  conflictEdgeKey,
  ConflictHighlight,
} from '../../../OntologyExplorer/utils/conflictHighlight';
import { computeGraphSearchHighlight } from '../../../OntologyExplorer/utils/graphSearchHighlight';
import { buildStudioGraphScope } from '../../../OntologyExplorer/utils/studioFocusedGraph';
import OntologyConceptDeleteDialog from '../OntologyAuthoringWorkspace/OntologyConceptDeleteDialog';
import { useOntologyConceptEditor } from '../OntologyConceptEditor/OntologyConceptEditor';
import OntologyConceptInspector from '../OntologyConceptInspector/OntologyConceptInspector';
import OntologyEmptyCard from '../OntologyEmptyCard/OntologyEmptyCard';
import OntologyNativeDataMode from '../OntologyGraphView/OntologyNativeDataMode';
import OntologyNewClassPanel from '../OntologyNewClassPanel/OntologyNewClassPanel';
import { placeNewClass } from '../OntologyNewClassPanel/OntologyNewClassPanel.utils';
import OntologyRelationDetail, {
  OntologyRelationStatus,
} from '../OntologyRelationControls/OntologyRelationDetail';
import OntologyConceptPicker from './OntologyConceptPicker';
import OntologyConceptSearch from './OntologyConceptSearch';
import { buildOntologyConflicts } from './OntologyConflicts.utils';
import OntologyConflictsPanel from './OntologyConflictsPanel';
import OntologyGraphModeTabs from './OntologyGraphModeTabs';
import OntologyGraphNodeList from './OntologyGraphNodeList';
import { useOntologyGraphSearchSlot } from './OntologyGraphSearchSlot.context';
import {
  AI_GRAPH_BACKDROP_CLASS,
  AI_GRAPH_CONTROLS_CLASS,
} from './OntologyGraphView.constants';
import OntologyTreeConflicts from './OntologyTreeConflicts';

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
const NO_GRAPH: OntologyGraphData = { nodes: [], edges: [] };
const NO_VIOLATIONS: OntologyProfileViolation[] = [];

const writeDataProperty = async (
  model: OntologyStudioModel,
  concept: OntologyConcept,
  input: ConceptPropertyInput
) => {
  if (input.kind === 'object') {
    return createOntologyProperty(
      buildObjectPropertyRequest(model, concept, input)
    );
  }
  if (!input.reusePropertyIri) {
    return createOntologyProperty(
      buildDataPropertyRequest(model, concept, input)
    );
  }
  const reused = model.properties.find(
    ({ iri }) => iri === input.reusePropertyIri
  );
  if (!reused) {
    throw new Error(input.reusePropertyIri);
  }
  const patch = buildReusePropertyPatch(reused, concept);

  return patch.length ? patchOntologyProperty(reused.id, patch) : reused;
};

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

const registerInverse = async ({
  inverse,
  reusedInverse,
}: RelationshipTypePlan) =>
  reusedInverse ?? (inverse ? createRelationshipType(inverse) : undefined);

/**
 * Links the unlinked inverse with this id back to the type that names it, whatever a retry is
 * called, so a relabelled retry never gives it a second primary. The registry comes back with the
 * linked inverse in place, so a retry drawn under the inverse's label is planned as a pair. While
 * nothing names the inverse, it is returned for the draft to reuse.
 */
const finishUnlinkedPair = async (
  registry: readonly RelationshipType[],
  id: string | undefined
): Promise<{
  registry: readonly RelationshipType[];
  unlinked?: RelationshipType;
}> => {
  const unlinked = registry.find((type) => type.id === id && !type.inverse);
  if (!unlinked) {
    return { registry };
  }
  const primary = registry.find((type) => type.inverse?.id === unlinked.id);
  if (!primary) {
    return { registry, unlinked };
  }
  const linked = await patchRelationshipType(
    unlinked.id,
    buildInverseBackLink(primary)
  );

  return {
    registry: registry.map((type) => (type === unlinked ? linked : type)),
  };
};

interface RelationshipTypeDialogProps {
  readonly label: string;
  /** The inverse's back link is a patch on the inverse type, which the registry authorizes as EditAll. */
  readonly canLinkInverse: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (draft: RelationshipTypeDraft) => void;
}

const RelationshipTypeDialog = ({
  label,
  canLinkInverse,
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
                hint={
                  canLinkInverse
                    ? undefined
                    : t('message.no-permission-for-action')
                }
                inputDataTestId="relationship-type-inverse"
                isDisabled={!canLinkInverse}
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
  /** Reads the definitions this release froze instead of the working draft; nothing is editable. */
  readonly releaseId?: string;
  readonly surface: 'graph' | 'tree';
  readonly onRequestGraphSurface: () => void;
  readonly onRequestTreeSurface?: () => void;
  readonly createConceptRequestKey?: number;
  readonly onCreateConceptRequestHandled?: () => void;
  readonly onRequestCreateConcept?: () => void;
  readonly onAuthoringLockChange?: (locked: boolean) => void;
  readonly isEditing?: boolean;
  readonly selectedConceptId?: string;
  readonly onSelectedConceptChange?: (id?: string) => void;
  /** Receives the concept whose Edit button was pressed, so the draft can open its editor. */
  readonly onRequestEdit?: (conceptId?: string) => void;
  /** A concept whose editor opens once Edit mode is on, set when Edit was pressed on a release. */
  readonly editConceptRequest?: string;
  readonly onEditConceptRequestHandled?: () => void;
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
  /** Where a double-click on empty canvas asked for the new concept, in canvas space. */
  readonly position?: { readonly x: number; readonly y: number };
}

// A published release is read-only, so its edit and delete rights are forced off whatever the role allows.
const useConceptRights = (
  conceptId: string | undefined,
  concepts: ReadonlyArray<{ id: string; deleted?: boolean }> | undefined,
  releaseId: string | undefined
) => {
  const { canEditAll, canDelete } = useEntityPermissions(
    ResourceEntity.ONTOLOGY_CONCEPT,
    { id: conceptId ?? '' },
    {
      enabled: Boolean(conceptId),
      deleted: concepts?.find((concept) => concept.id === conceptId)?.deleted,
    }
  );

  return {
    canEditByRights: canEditAll,
    canEdit: canEditAll && !releaseId,
    canDelete: canDelete && !releaseId,
  };
};

// The graph can be drawn from the release when the working list is refused, so the editor reads
// the one concept it edits from the draft by id, the read a concept owner is still allowed.
const useDraftConcept = (
  editor: ConceptEditorRequest | undefined,
  isEditing: boolean,
  releaseId: string | undefined,
  revision: number
) => {
  const conceptId = editor?.conceptId;

  return useQuery<OntologyConcept>({
    enabled: Boolean(conceptId) && isEditing && !releaseId,
    gcTime: 0,
    // A refetch after a relation or property write keeps the panel editable, so unsaved field edits survive it.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === conceptId ? previous : undefined,
    queryFn: ({ signal }) =>
      getOntologyConcept(conceptId ?? '', WORKING_CONCEPT_FIELDS, signal),
    queryKey: ['ontology-draft-concept', conceptId, revision],
    retry: false,
    staleTime: 0,
  });
};

/** Graph and Tree both float the conflicts and health cards, so Validate all stays reachable from either. */
const showsCanvasCards = (graphMode: string, openPanels: unknown[]) =>
  graphMode !== 'data' && !openPanels.some(Boolean);

/** The concept whose working copy loads: one being authored, else the selection. */
const getDraftRequest = (
  editor: ConceptEditorRequest | undefined,
  selectedId: string | undefined
): ConceptEditorRequest | undefined =>
  editor ?? (selectedId ? { conceptId: selectedId } : undefined);

type InspectorProps = ComponentProps<typeof OntologyConceptInspector>;

interface EditableConceptInspectorProps extends Omit<InspectorProps, 'editor'> {
  readonly editable: Parameters<typeof useOntologyConceptEditor>[0];
  /** Edit mode with the concept's working copy loaded: its fields edit in place. */
  readonly isEditable: boolean;
}

/**
 * The concept panel. It stays mounted while the working copy loads, so an add
 * form the user already opened survives the switch to in-place editing.
 */
const EditableConceptInspector = ({
  editable,
  isEditable,
  ...props
}: EditableConceptInspectorProps) => {
  const editor = useOntologyConceptEditor(editable);
  const { reset } = editor;
  const { isEditing } = props;

  // Leaving Edit discards the in-place edits, so nothing stays marked unsaved in View.
  useEffect(() => {
    if (!isEditing) {
      reset();
    }
  }, [isEditing, reset]);

  return (
    <OntologyConceptInspector
      {...props}
      editor={isEditable ? editor : undefined}
    />
  );
};

const OntologyGraphView = ({
  ontology,
  releaseId,
  surface,
  onRequestGraphSurface,
  onRequestTreeSurface,
  createConceptRequestKey = 0,
  onCreateConceptRequestHandled,
  onRequestCreateConcept,
  onAuthoringLockChange,
  isEditing = false,
  selectedConceptId,
  onSelectedConceptChange,
  onRequestEdit,
  editConceptRequest,
  onEditConceptRequestHandled,
  onStatsChange,
  onWorkingChange,
}: OntologyGraphViewProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const searchSlot = useOntologyGraphSearchSlot();
  const graphRef = useRef<OntologyGraphHandle>(null);
  const [typeDraft, setTypeDraft] = useState<{
    label: string;
    resolve: (draft?: RelationshipTypeDraft) => void;
  }>();
  // The inverse this view registered and has not linked back yet. A retry reuses or links it, since
  // a delete needs a right the dialog never checks and a soft delete leaves its name taken.
  const unlinkedInverseId = useRef<string>();
  const handledCreateConceptRequest = useRef(0);
  const [nodePositions, setNodePositions] =
    useState<Record<string, { x: number; y: number }>>();
  const creationPositions = useRef<Record<string, { x: number; y: number }>>();
  const { canEditAll: canEditOntologyByRights } = useEntityPermissions(
    ResourceEntity.ONTOLOGY,
    { id: ontology.id },
    { deleted: ontology.deleted }
  );
  const canEditOntology = canEditOntologyByRights && !releaseId;

  const [search, setSearch] = useState('');
  const [graphMode, setGraphMode] = useState<'model' | 'data'>('model');
  const [hasOpenedData, setHasOpenedData] = useState(false);
  const [dataRevision, setDataRevision] = useState(0);
  const noteWorkingChange = useCallback(() => {
    setDataRevision((revision) => revision + 1);
    onWorkingChange?.();
  }, [onWorkingChange]);
  const changeGraphMode = useCallback((mode: 'model' | 'data') => {
    setGraphMode(mode);
    if (mode === 'data') {
      setHasOpenedData(true);
    }
  }, []);
  const [localSelectedId, setLocalSelectedId] = useState<string>();
  const selectedId = onSelectedConceptChange
    ? selectedConceptId
    : localSelectedId;
  const [conceptEditor, setConceptEditor] = useState<ConceptEditorRequest>();
  // A concept to bring into view once the graph is drawn: Show on graph from the Tree or the Data
  // view asks before the Model graph exists, so the graph focuses it when it mounts.
  const [pendingFocusId, setPendingFocusId] = useState<string>();
  useEffect(() => {
    if (selectedId) {
      setPendingFocusId(undefined);
    }
  }, [selectedId]);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string>();
  // The concept a relationship was opened from, so its panel can lead back there.
  const [relationBackId, setRelationBackId] = useState<string>();
  const reportedEdgeId = useRef<string>();
  const [isDeletingConcept, setIsDeletingConcept] = useState(false);
  const guard = useOntologyDraftGuard();
  const { runConfirmed } = useContext(OntologyDraftContext);
  const setSelectedId = useCallback(
    (id?: string) =>
      guard(() => {
        setConceptEditor(undefined);
        (onSelectedConceptChange ?? setLocalSelectedId)(id);
      }),
    [guard, onSelectedConceptChange]
  );
  // Link data in the Data view opens this concept's panel in Edit on its data-asset link form.
  const [linkAssetsConceptId, setLinkAssetsConceptId] = useState<string>();
  const [dataSelectedAssetId, setDataSelectedAssetId] = useState<string>();
  const clearLinkAssetsRequest = useCallback(
    () => setLinkAssetsConceptId(undefined),
    []
  );
  const requestLinkAssets = (conceptId: string) => {
    setLinkAssetsConceptId(conceptId);
    if (selectedId !== conceptId) {
      setSelectedId(conceptId);
    }
    if (!isEditing) {
      onRequestEdit?.(conceptId);
    }
  };
  const { graph, isError, isFetching, isLoading, model, refetch, relations } =
    useOntologyStudioModel(ontology, releaseId);
  // Edit mode edits the selected concept in place, so its working copy loads on selection.
  const draftConceptQuery = useDraftConcept(
    getDraftRequest(conceptEditor, selectedId),
    isEditing,
    releaseId,
    dataRevision
  );
  const conflictsQuery = useQuery({
    enabled: !releaseId,
    queryFn: () => getOntologyWorkingValidation(ontology.id),
    queryKey: ['ontology-working-validation', ontology.id, dataRevision],
    staleTime: 0,
  });
  const conflictViolations = useMemo(
    () => conflictsQuery.data?.violations ?? NO_VIOLATIONS,
    [conflictsQuery.data]
  );
  const readableViolations = useMemo(() => {
    const concepts = (model?.concepts ?? []).map((concept) => ({
      name: concept.name,
      iri: concept.iri,
      label: getEntityName(concept),
    }));

    return conflictViolations.map((violation) => ({
      ...violation,
      message: toReadableViolationMessage(violation.message, concepts),
    }));
  }, [conflictViolations, model?.concepts]);
  const conflicts = useMemo(
    () => buildOntologyConflicts(readableViolations, relations),
    [readableViolations, relations]
  );
  // The concept whose drawer opens with its conflict box expanded, from the canvas Resolve link.
  const [conflictReviewId, setConflictReviewId] = useState<string>();
  const treeConflicts = useMemo(() => {
    const byConcept = new Map<string, string[]>();
    readableViolations.forEach(({ conceptIds = [], message }) =>
      conceptIds.forEach((conceptId) =>
        byConcept.set(conceptId, [...(byConcept.get(conceptId) ?? []), message])
      )
    );

    return byConcept;
  }, [readableViolations]);
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
  const searchMatchIds = useMemo(
    () =>
      new Set(
        searchHighlight?.active ? searchHighlight.highlightedNodeIds : []
      ),
    [searchHighlight]
  );
  const searchResults = useMemo(
    () =>
      graph ? rankConceptMatches(graph.nodes, searchMatchIds, search) : [],
    [graph, search, searchMatchIds]
  );
  const scope = useMemo(
    () =>
      buildStudioGraphScope(graph ?? NO_GRAPH, {
        seedIds: [
          ...(selectedId ? [selectedId] : []),
          ...searchResults.map(({ id }) => id),
        ],
      }),
    [graph, searchResults, selectedId]
  );
  const conflictHighlight = useMemo<ConflictHighlight>(
    () => buildConflictHighlight(conflictViolations, scope.graph.edges),
    [conflictViolations, scope.graph.edges]
  );
  const graphNodes = useMemo(
    () =>
      conflictHighlight.nodeIds.size
        ? scope.graph.nodes.map((node) =>
            conflictHighlight.nodeIds.has(node.id)
              ? { ...node, hasConflict: true }
              : node
          )
        : scope.graph.nodes,
    [conflictHighlight, scope.graph.nodes]
  );
  const nodeListEntries = useMemo(
    () =>
      [...scope.graph.nodes].sort((left, right) =>
        left.label.localeCompare(right.label)
      ),
    [scope]
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const hadSelection = useRef(false);
  // Closing the panel puts focus back where the keyboard opened it, or on the
  // Find box when the opener is gone, instead of dropping it on the page body.
  useEffect(() => {
    if (selectedId) {
      const active = document.activeElement;
      if (
        !hadSelection.current &&
        active instanceof HTMLElement &&
        active !== document.body
      ) {
        opener.current = active;
      }
      hadSelection.current = true;

      return;
    }
    if (!hadSelection.current) {
      return;
    }
    hadSelection.current = false;
    const target = opener.current?.isConnected
      ? opener.current
      : rootRef.current?.querySelector<HTMLElement>(
          '[data-testid="ontology-graph-search"]'
        ) ??
        document.querySelector<HTMLElement>(
          '[data-testid="ontology-graph-search"]'
        );
    opener.current = null;
    target?.focus();
  }, [selectedId]);
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
  const flagsOf = (resource: ResourceEntity) =>
    getDerivedPermissionFlags(
      permissions[resource] ?? DEFAULT_ENTITY_PERMISSION
    );
  const canCreateDefinition = (resource: ResourceEntity) =>
    isEditing && !releaseId && !ontology.deleted && flagsOf(resource).canCreate;
  const canCreateConcept = canCreateDefinition(ResourceEntity.ONTOLOGY_CONCEPT);
  const canCreateChangeSet = canCreateDefinition(
    ResourceEntity.ONTOLOGY_CHANGE_SET
  );
  const canCreateNewClass = [
    canCreateConcept,
    canCreateChangeSet,
    canEditOntology,
  ].every(Boolean);
  const canCreateProperty = canCreateDefinition(
    ResourceEntity.ONTOLOGY_PROPERTY
  );
  const canCreateAxiom = canCreateDefinition(ResourceEntity.ONTOLOGY_AXIOM);
  const canCreateRelationType = [
    ResourceEntity.RELATIONSHIP_TYPE,
    ResourceEntity.ONTOLOGY_PROPERTY,
    ResourceEntity.ONTOLOGY_AXIOM,
  ].every(canCreateDefinition);
  const canLinkInverse = flagsOf(ResourceEntity.RELATIONSHIP_TYPE).canEditAll;
  const {
    canEditByRights: canEditConceptByRights,
    canEdit: canEditConcept,
    canDelete: canDeleteConcept,
  } = useConceptRights(
    conceptEditor?.conceptId ?? selectedId,
    model?.concepts,
    releaseId
  );
  // Data shows the selected concept whenever one is selected, so its rights apply there too.
  const canEditDataBindings = canEditOntology || canEditConcept;
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
  // Every relation ends in an axiom, so nothing is planned without the right to create one.
  // Label lookups keep the whole catalog, so a type hidden here is reused, never registered twice.
  const propertyWrites = useMemo(
    () => (model && canCreateAxiom ? planNativeProperties(model, catalog) : []),
    [canCreateAxiom, catalog, model]
  );
  const relinkedPropertyFqns = useMemo(
    () =>
      propertyWrites.flatMap(({ steps }) =>
        steps.flatMap((step) => (step.kind === 'link' ? [step.fqn] : []))
      ),
    [propertyWrites]
  );
  // Edit rights are read per property, because a property inherits the ontology's owners and a
  // resource-level read counts an owner rule as denied.
  const { flagsByFqn: propertyFlags } = useBulkEntityPermissions(
    ResourceEntity.ONTOLOGY_PROPERTY,
    relinkedPropertyFqns
  );
  const canWrite = useCallback(
    (step: NativeRelationStep): boolean => {
      switch (step.kind) {
        case 'property':
          return canCreateProperty;
        case 'link':
          return Boolean(propertyFlags[step.fqn]?.canEditAll);
        case 'axiom':
          return canCreateAxiom;
      }
    },
    [canCreateAxiom, canCreateProperty, propertyFlags]
  );
  const relationTypeGroups = useMemo(
    () =>
      buildNativeRelationGroups(
        propertyWrites
          .filter(({ steps }) => steps.every(canWrite))
          .map(({ type }) => type),
        {
          hierarchy: t('label.hierarchy'),
          relationships: t('label.relationship-plural'),
        }
      ),
    [canWrite, propertyWrites, t]
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
      // The cached list is up to 30 s old. A type registered since then is reused with its inverse,
      // and new names are chosen apart from everything the registry holds now.
      const { registry, unlinked } = await finishUnlinkedPair(
        await loadRegistry(),
        unlinkedInverseId.current
      );
      unlinkedInverseId.current = unlinked?.id;
      const registered = findNativeRelationTypeByLabel(
        catalogOf(registry),
        draft.label
      );
      if (registered) {
        void refetchRegistry();

        return registered;
      }
      const plan = planRelationshipType(draft, registry, unlinked);
      const inverse = await registerInverse(plan);
      if (inverse) {
        unlinkedInverseId.current = inverse.id;
      }
      const primary = await createRelationshipType(plan.primary);
      if (inverse) {
        await patchRelationshipType(inverse.id, buildInverseBackLink(primary));
        unlinkedInverseId.current = undefined;
      }
      void refetchRegistry();

      return toNativeRelationType(
        primary,
        inverse ? [primary, inverse] : [primary]
      );
    },
    [canCreateRelationType, catalog, catalogOf, refetchRegistry]
  );

  const issueFor = useCallback(
    (
      fromId: string,
      toId: string,
      typeId: string,
      among: readonly OntologyModelRelation[] = relations
    ): string | undefined => {
      const from = model?.concepts.find((concept) => concept.id === fromId);
      const to = model?.concepts.find((concept) => concept.id === toId);
      const label = typeId.startsWith(NEW_RELATION_TYPE_PREFIX)
        ? typeId.slice(NEW_RELATION_TYPE_PREFIX.length)
        : undefined;
      const type =
        catalog.find((candidate) => candidate.id === typeId) ??
        (label === undefined
          ? undefined
          : ({
              group: 'custom',
              id: typeId,
              kind: 'objectProperty',
              label,
              name: label,
              paletteKey: PaletteKey.Purple,
            } as const));
      const issue =
        from && to && type
          ? checkNativeRelation({ from, relations: among, to, type })
          : undefined;

      return issue ? describeRelationIssue(t, issue) : undefined;
    },
    [catalog, model, relations, t]
  );

  const warnFor = useCallback<RelationWarningCheck>(
    async (fromId, toId, typeId) => {
      const from = model?.concepts.find((concept) => concept.id === fromId);
      const to = model?.concepts.find((concept) => concept.id === toId);
      const type = catalog.find((candidate) => candidate.id === typeId);

      if (!model || !from || !to || !type) {
        return undefined;
      }

      return findRelationClash({ from, model, to, type });
    },
    [catalog, model]
  );

  const resolveRelationType = useCallback(
    async (relationType: string) =>
      relationType.startsWith(NEW_RELATION_TYPE_PREFIX)
        ? createType(relationType.slice(NEW_RELATION_TYPE_PREFIX.length))
        : catalog.find((candidate) => candidate.id === relationType) ??
          missingRelationType(relationType),
    [catalog, createType]
  );

  const createRelation = useCallback(
    async (
      fromId: string,
      toId: string,
      relationType: string
    ): Promise<boolean> => {
      if (!model) {
        return false;
      }
      const from = model.concepts.find((concept) => concept.id === fromId);
      const to = model.concepts.find((concept) => concept.id === toId);
      if (!from || !to) {
        showErrorToast(t('server.unexpected-error'));

        return false;
      }
      const issue = issueFor(fromId, toId, relationType);
      if (issue) {
        showErrorToast(issue);

        return false;
      }
      let written = false;
      try {
        const type = await resolveRelationType(relationType);
        if (!type) {
          return false;
        }
        const steps = planNativeRelation({ from, model, to, type });
        if (!steps.every(canWrite)) {
          showErrorToast(t('message.no-permission-for-action'));

          return false;
        }
        for (const step of steps) {
          written = true;
          await writeStep(step);
        }

        return true;
      } catch (error) {
        showWriteError(error);

        return false;
      } finally {
        if (written) {
          noteWorkingChange();
          await refetch();
        }
      }
    },
    [
      canWrite,
      issueFor,
      model,
      noteWorkingChange,
      refetch,
      resolveRelationType,
      showWriteError,
      t,
    ]
  );

  const deleteRelation = useCallback(
    async (
      relation: OntologyModelRelation,
      { isSilent = false }: { isSilent?: boolean } = {}
    ): Promise<boolean> => {
      const axiom = relation.axiom;
      if (!axiom) {
        return false;
      }
      const expressionIndex = axiom.expressions.findIndex((expression) =>
        relation.kind === 'restriction'
          ? expression.propertyIri === relation.propertyIri &&
            expression.filler?.classIri === relation.to.iri
          : expression.classIri === relation.to.iri
      );
      const isWholeAxiom = axiom.expressions.length <= 1 || expressionIndex < 0;
      try {
        if (isWholeAxiom) {
          await softDeleteOntologyDefinition('axiom', axiom.id);
        } else {
          await patchOntologyAxiom(axiom.id, [
            { op: 'remove', path: `/expressions/${expressionIndex}` },
          ]);
        }
      } catch (error) {
        showWriteError(error);

        return false;
      }
      noteWorkingChange();
      await refetch();
      if (!isSilent) {
        if (isWholeAxiom) {
          showUndoToast(
            t('message.ontology-relationship-deleted'),
            async () => {
              try {
                await restoreOntologyDefinition('axiom', axiom.id);
                noteWorkingChange();
                await refetch();
              } catch (error) {
                showWriteError(error);
              }
            }
          );
        } else {
          showSuccessToast(t('message.ontology-relationship-deleted'));
        }
      }

      return true;
    },
    [noteWorkingChange, refetch, showWriteError, t]
  );

  const changeRelationType = useCallback(
    async (
      relation: OntologyModelRelation,
      typeId: string
    ): Promise<boolean> => {
      const issue = issueFor(
        relation.from.id,
        relation.to.id,
        typeId,
        relations.filter((candidate) => candidate.key !== relation.key)
      );
      if (issue) {
        showErrorToast(issue);

        return false;
      }
      const isCreated = await createRelation(
        relation.from.id,
        relation.to.id,
        typeId
      );

      return isCreated && deleteRelation(relation, { isSilent: true });
    },
    [createRelation, deleteRelation, issueFor, relations]
  );

  const deleteSelectedConcept = useCallback(
    () => setIsDeletingConcept(true),
    []
  );

  const createDataProperty = useCallback(
    async (
      conceptId: string,
      input: ConceptPropertyInput
    ): Promise<boolean> => {
      const concept = model?.concepts.find((item) => item.id === conceptId);
      if (!model || !concept || !canCreateProperty) {
        return false;
      }
      try {
        await writeDataProperty(model, concept, input);
        noteWorkingChange();
        await refetch();

        return true;
      } catch (error) {
        showWriteError(error);

        return false;
      }
    },
    [canCreateProperty, model, noteWorkingChange, refetch, showWriteError]
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

  const canOpenRequestedEditor = [
    Boolean(editConceptRequest),
    isEditing,
    canEditConceptByRights,
    selectedId === editConceptRequest,
    Boolean(
      model?.concepts.some((concept) => concept.id === editConceptRequest)
    ),
  ].every(Boolean);
  // Leaving Edit discards a New concept form (the guard already asked), so it must not
  // come back when Edit is reopened.
  useEffect(() => {
    if (!isEditing) {
      setConceptEditor(undefined);
    }
  }, [isEditing]);
  const requestedConceptId = model?.concepts.some(
    (concept) => concept.id === editConceptRequest
  )
    ? editConceptRequest
    : undefined;
  // A request from outside the graph (a Concepts row) arrives with nothing selected; select it.
  // The requester already ran the draft guard, so this selection does not ask again.
  useEffect(() => {
    if (isEditing && requestedConceptId && selectedId !== requestedConceptId) {
      runConfirmed(() =>
        (onSelectedConceptChange ?? setLocalSelectedId)(requestedConceptId)
      );
    }
  }, [
    isEditing,
    onSelectedConceptChange,
    requestedConceptId,
    runConfirmed,
    selectedId,
  ]);
  useEffect(() => {
    if (canOpenRequestedEditor) {
      onEditConceptRequestHandled?.();
    }
  }, [canOpenRequestedEditor, editConceptRequest, onEditConceptRequestHandled]);

  useEffect(() => {
    if (
      isEditing &&
      createConceptRequestKey > 0 &&
      handledCreateConceptRequest.current !== createConceptRequestKey
    ) {
      handledCreateConceptRequest.current = createConceptRequestKey;
      onCreateConceptRequestHandled?.();
      runConfirmed(() =>
        (onSelectedConceptChange ?? setLocalSelectedId)(undefined)
      );
      setConceptEditor({});
      setGraphMode('model');
      onRequestGraphSurface();
    }
  }, [
    createConceptRequestKey,
    isEditing,
    onCreateConceptRequestHandled,
    onRequestGraphSurface,
    onSelectedConceptChange,
    runConfirmed,
  ]);

  const dataConcepts = useMemo(() => {
    const concepts = model?.concepts ?? [];
    const nameByIri = new Map(
      concepts.map((concept) => [concept.iri, getEntityName(concept)])
    );

    return concepts.map((concept) => ({
      id: concept.id,
      name: getEntityName(concept),
      parentName: nameByIri.get(concept.superClasses?.[0] ?? ''),
      synonyms: concept.synonyms,
    }));
  }, [model?.concepts]);
  const pickerConcepts = useMemo(() => {
    const parentById = new Map(
      dataConcepts.map((concept) => [concept.id, concept.parentName])
    );

    return (graph?.nodes ?? []).map((node) => ({
      id: node.id,
      name: node.label,
      parentName: parentById.get(node.id),
    }));
  }, [dataConcepts, graph?.nodes]);

  const conceptGhost = useMemo(
    () =>
      isEditing && conceptEditor?.position && !conceptEditor.conceptId
        ? { ...conceptEditor.position, label: t('label.new-concept') }
        : undefined,
    [conceptEditor, isEditing, t]
  );

  const getConceptProperties = useCallback(
    (conceptId: string) => {
      const concept = model?.concepts.find((item) => item.id === conceptId);

      return model && concept
        ? getBindableConceptProperties(model, relations, concept)
        : [];
    },
    [model, relations]
  );

  if ([isError, !model].every(Boolean)) {
    return (
      <Alert
        rightContent={
          <Button color="secondary" size="sm" onPress={() => void refetch()}>
            {t('label.retry')}
          </Button>
        }
        variant="error">
        {t('server.entity-fetch-error', { entity: t('label.ontology') })}
      </Alert>
    );
  }
  if (isLoading || !model || !graph) {
    return <Loader />;
  }

  const selectedRelation = relations.find(
    (relation) => relation.key === selectedEdgeKey
  );
  const selectNode = ({ id }: { id: string }) => {
    setConflictReviewId(undefined);
    setSelectedEdgeKey(undefined);
    graphRef.current?.clearEdgeSelection();
    setSelectedId(id);
  };
  const placeConceptAt = (position: { x: number; y: number }) => {
    runConfirmed(() =>
      (onSelectedConceptChange ?? setLocalSelectedId)(undefined)
    );
    setSelectedEdgeKey(undefined);
    setConceptEditor({ position });
  };
  const resolveConflict = (conceptId: string) => {
    selectNode({ id: conceptId });
    setConflictReviewId(conceptId);
  };
  // All of it behind the discard prompt, so Cancel leaves the drawer, mode and surface as they were.
  const showConflictOnGraph = (conceptId: string) =>
    guard(() => {
      setConflictReviewId(undefined);
      setSelectedId(undefined);
      setPendingFocusId(conceptId);
      changeGraphMode('model');
      if (surface !== 'graph') {
        onRequestGraphSurface();
      }
      graphRef.current?.focusNode(conceptId);
    });
  const connectNode = ({ id }: { id: string }) => {
    setSelectedId(id);
    onRequestEdit?.();
  };
  const openRelationFrom = (
    conceptId: string,
    relation: OntologyModelRelation
  ) =>
    guard(() => {
      setConceptEditor(undefined);
      (onSelectedConceptChange ?? setLocalSelectedId)(undefined);
      setRelationBackId(conceptId);
      setSelectedEdgeKey(relation.key);
    });
  const relationStatusOf = (
    relation: OntologyModelRelation
  ): OntologyRelationStatus => {
    if (
      conflictHighlight.edgeKeys.has(
        conflictEdgeKey({ from: relation.from.id, to: relation.to.id })
      )
    ) {
      return 'conflict';
    }

    return conflictsQuery.data ? 'clear' : 'unchecked';
  };
  const saveRelationDescription = async (
    relation: OntologyModelRelation,
    description: string
  ) => {
    if (!relation.axiom) {
      return false;
    }
    try {
      await patchOntologyAxiom(relation.axiom.id, [
        { op: 'add', path: '/description', value: description },
      ]);
      noteWorkingChange();
      await refetch();

      return true;
    } catch (error) {
      showWriteError(error);

      return false;
    }
  };

  const renderConceptEditor = () => {
    return (
      <OntologyNewClassPanel
        canCreate={canCreateNewClass}
        canCreateAxiom={canCreateAxiom}
        canCreateProperty={canCreateProperty}
        model={model}
        ontology={ontology}
        onBeforeCreate={() => {
          creationPositions.current =
            graphRef.current?.getNodePositions() ?? {};
        }}
        onClose={() => guard(() => setConceptEditor(undefined))}
        onCreated={async (iri, { keepOpen }) => {
          const refreshed = await refetch();
          if (refreshed.error || !refreshed.data) {
            return false;
          }
          const created = refreshed.data.concepts.find((c) => c.iri === iri);
          if (!created) {
            return false;
          }
          const oldNodes = buildOntologyStudioGraph(
            refreshed.data
          ).nodes.filter((n) => n.id !== created.id);
          const positions = placeNewClass(
            creationPositions.current ??
              graphRef.current?.getNodePositions() ??
              {},
            oldNodes,
            created.id
          );
          setNodePositions(
            conceptEditor?.position
              ? { ...positions, [created.id]: conceptEditor.position }
              : positions
          );
          if (keepOpen) {
            setConceptEditor({});
          } else {
            runConfirmed(() =>
              (onSelectedConceptChange ?? setLocalSelectedId)(created.id)
            );
            setConceptEditor(undefined);
          }
          noteWorkingChange();

          return true;
        }}
        onLockChange={onAuthoringLockChange}
        onUndone={() => {
          void refetch();
          noteWorkingChange();
        }}
      />
    );
  };

  const renderDeleteConceptDialog = () =>
    isDeletingConcept && selected ? (
      <OntologyConceptDeleteDialog
        concept={selected}
        onCancel={() => setIsDeletingConcept(false)}
        onDeleted={({ restore }) => {
          setIsDeletingConcept(false);
          (onSelectedConceptChange ?? setLocalSelectedId)(undefined);
          noteWorkingChange();
          void refetch();
          showUndoToast(
            t('message.ontology-definition-deleted', {
              name: selected.displayName ?? selected.name,
            }),
            async () => {
              try {
                await restore();
                noteWorkingChange();
                await refetch();
              } catch (error) {
                showWriteError(error);
              }
            }
          );
        }}
      />
    ) : null;

  const renderRelationDetail = (selectedRelation: OntologyModelRelation) => {
    return (
      <OntologyRelationDetail
        backConcept={model.concepts.find(
          (concept) => concept.id === relationBackId
        )}
        canCreateRelationType={canCreateRelationType}
        canEdit={isEditing && canCreateAxiom}
        checkType={(typeId) =>
          issueFor(
            selectedRelation.from.id,
            selectedRelation.to.id,
            typeId,
            relations.filter(
              (candidate) => candidate.key !== selectedRelation.key
            )
          )
        }
        groups={relationTypeGroups}
        key={selectedRelation.key}
        relation={selectedRelation}
        status={relationStatusOf(selectedRelation)}
        onClose={() => {
          setSelectedEdgeKey(undefined);
          graphRef.current?.clearEdgeSelection();
        }}
        onDelete={async () => {
          const isDeleted = await deleteRelation(selectedRelation);
          if (isDeleted) {
            setSelectedEdgeKey(undefined);
          }

          return isDeleted;
        }}
        onEdit={async (typeId) => {
          const isChanged = await changeRelationType(selectedRelation, typeId);
          if (isChanged) {
            setSelectedEdgeKey(undefined);
          }

          return isChanged;
        }}
        onOpenConcept={(conceptId) => selectNode({ id: conceptId })}
        onSaveDescription={(description) =>
          saveRelationDescription(selectedRelation, description)
        }
      />
    );
  };

  const getWorkingConcept = () =>
    [isEditing, !releaseId, canEditConcept].every(Boolean)
      ? draftConceptQuery.data
      : undefined;

  const getEditable = (
    selected: OntologyConcept,
    workingConcept: OntologyConcept | undefined
  ) => ({
    canEdit: [Boolean(workingConcept), canEditConcept].every(Boolean),
    concept: workingConcept ?? selected,
    ontology,
    onSaved: (saved: OntologyConcept) => {
      noteWorkingChange();
      void refetch();
      void draftConceptQuery.refetch();
      setSelectedId(saved.id);
    },
  });

  const renderInspector = (
    selected: NonNullable<typeof model>['concepts'][number]
  ) => {
    const workingConcept = getWorkingConcept();

    return (
      <EditableConceptInspector
        canAddProperty={canCreateProperty}
        canAddRelation={canCreateAxiom}
        canAddRule={canCreateAxiom}
        canCreateRelationType={canCreateRelationType}
        canEditBindings={isEditing && canEditConcept}
        canEditRelations={isEditing && canCreateAxiom}
        checkAddRelation={(targetId, typeId) =>
          issueFor(selected.id, targetId, typeId)
        }
        checkRelationType={(relation, typeId) =>
          issueFor(
            relation.from.id,
            relation.to.id,
            typeId,
            relations.filter((candidate) => candidate.key !== relation.key)
          )
        }
        concept={selected}
        confirmDialog={renderDeleteConceptDialog()}
        conflicts={conflicts.filter(({ violation }) =>
          violation.conceptIds?.includes(selected.id)
        )}
        editable={getEditable(selected, workingConcept)}
        findRelationType={(phrase) =>
          findNativeRelationTypeByPhrase(catalog, phrase)?.id
        }
        isConflictReviewOpen={conflictReviewId === selected.id}
        isEditable={Boolean(workingConcept)}
        isEditing={isEditing}
        isEditorUnavailable={
          [isEditing, !releaseId, canEditConcept].every(Boolean) &&
          draftConceptQuery.isError
        }
        isLinkAssetsRequested={linkAssetsConceptId === selected.id}
        key={selected.id}
        model={model}
        relationTypeGroups={relationTypeGroups}
        relations={relations}
        selectedAssetId={graphMode === 'data' ? dataSelectedAssetId : undefined}
        onAddProperty={(input) => createDataProperty(selected.id, input)}
        onAddRelation={(targetId, relationType) =>
          createRelation(selected.id, targetId, relationType)
        }
        onClose={() => {
          clearLinkAssetsRequest();
          setConflictReviewId(undefined);
          setSelectedId(undefined);
        }}
        onDelete={
          isEditing && canDeleteConcept ? deleteSelectedConcept : undefined
        }
        onDeleteRelation={(relation) => deleteRelation(relation)}
        onEdit={
          canEditConceptByRights
            ? () => onRequestEdit?.(selected.id)
            : undefined
        }
        onEditRelation={changeRelationType}
        onLinkAssetsRequestClosed={clearLinkAssetsRequest}
        onOpenRelation={(relation) => openRelationFrom(selected.id, relation)}
        onRuleCreated={() => {
          noteWorkingChange();
          void refetch();
        }}
        onSelectConcept={(concept) => setSelectedId(concept.id)}
        onShowConflictOnGraph={() => showConflictOnGraph(selected.id)}
      />
    );
  };

  const renderSidebar = () => {
    if (conceptEditor && isEditing && !conceptEditor.conceptId) {
      return renderConceptEditor();
    }

    if (selectedRelation && !selected) {
      return renderRelationDetail(selectedRelation);
    }

    if (selected) {
      return renderInspector(selected);
    }

    return null;
  };

  const conflictConceptLabel = (conceptId: string) => {
    const concept = model?.concepts.find(
      (candidate) => candidate.id === conceptId
    );

    return concept ? getEntityName(concept) : undefined;
  };

  // Conflicts float top-right under Model / Data; health floats bottom-right.
  const hasCanvasCards = showsCanvasCards(graphMode, [
    selected,
    selectedRelation,
    conceptEditor,
  ]);

  const renderCanvasCards = () => {
    if (!hasCanvasCards) {
      return null;
    }

    return (
      <>
        {releaseId || surface === 'tree' ? null : (
          <OntologyConflictsPanel
            conceptLabel={conflictConceptLabel}
            conflicts={conflicts}
            isChecking={conflictsQuery.isFetching}
            isFailed={conflictsQuery.isError}
            onResolve={resolveConflict}
            onValidateAll={() => void conflictsQuery.refetch()}
          />
        )}
        <OntologyHealthPanel
          isRaised
          health={health}
          onConnect={canEditOntology ? connectNode : undefined}
        />
      </>
    );
  };

  const renderDataSurface = () =>
    hasOpenedData ? (
      <div
        className={
          graphMode === 'data'
            ? 'tw:relative tw:flex tw:min-h-0 tw:flex-1 tw:flex-col'
            : undefined
        }
        hidden={graphMode !== 'data'}>
        <OntologyNativeDataMode
          linkWhenPickedEmpty
          canEditBindings={canEditDataBindings}
          concepts={pickerConcepts}
          getConceptProperties={getConceptProperties}
          isActive={graphMode === 'data'}
          ontologyId={ontology.id}
          revision={dataRevision}
          selectedConceptId={selectedId}
          onLinkData={canEditDataBindings ? requestLinkAssets : undefined}
          onSelectConcept={setSelectedId}
          onSelectedAssetChange={setDataSelectedAssetId}
        />
      </div>
    ) : null;

  const renderGraphControls = () => {
    const controls = (
      <OntologyControlButtons
        isLoading={isFetching}
        onFitToScreen={() => void graphRef.current?.fitView()}
        onRefresh={() => void refetch()}
        onZoomIn={() => graphRef.current?.zoomIn()}
        onZoomOut={() => graphRef.current?.zoomOut()}
      />
    );

    return isAiMode ? (
      <div
        className={AI_GRAPH_CONTROLS_CLASS}
        data-testid="ontology-graph-controls">
        {controls}
      </div>
    ) : (
      <Card
        className="tw:absolute tw:bottom-4 tw:left-4 tw:z-6 tw:flex tw:items-center tw:rounded-lg"
        data-testid="ontology-graph-controls"
        variant="elevated">
        {controls}
      </Card>
    );
  };

  const renderScopeNotice = () => {
    if (!scope.isFocused) {
      return null;
    }
    // Nothing drawn yet: pick a concept here instead of hunting for Find or Tree.
    if (scope.shownCount === 0) {
      return (
        <div
          className="tw:absolute tw:inset-0 tw:z-5 tw:flex tw:items-center tw:justify-center tw:p-6"
          data-testid="ontology-graph-too-large">
          <Box align="center" className="tw:max-w-md" direction="col" gap={3}>
            <Typography
              as="p"
              className="tw:m-0 tw:text-center"
              color="secondary"
              size="text-sm">
              {t('message.ontology-graph-too-large', {
                total: scope.totalCount,
              })}
            </Typography>
            <OntologyConceptPicker
              concepts={pickerConcepts}
              onPick={(id) => selectNode({ id })}
            />
          </Box>
        </div>
      );
    }

    return (
      <div className="tw:absolute tw:top-16 tw:left-1/2 tw:z-6 tw:w-[min(32rem,calc(100%-2rem))] tw:-translate-x-1/2">
        <Alert data-testid="ontology-graph-focused-notice" variant="brand">
          {t('message.ontology-graph-focused', {
            shown: scope.shownCount,
            total: scope.totalCount,
          })}
          {onRequestTreeSurface ? (
            <Button
              color="secondary"
              data-testid="ontology-graph-open-tree"
              size="sm"
              onPress={onRequestTreeSurface}>
              {t('label.open-entity', { entity: t('label.tree') })}
            </Button>
          ) : null}
        </Alert>
      </div>
    );
  };

  // On Tree each conflict marks its concept rows; only a failed check gets a strip.
  const renderTreeConflicts = () =>
    !releaseId && conflictsQuery.isError ? (
      <OntologyTreeConflicts onRetry={() => void conflictsQuery.refetch()} />
    ) : undefined;

  const renderSurface = () => {
    if (surface === 'tree') {
      return (
        // The tree takes the full width; the floating cards sit on top, as in the design.
        <div className="tw:h-full" data-testid="ontology-tree-surface">
          <OntologyTreeView
            density="compact"
            emptyMessage={t('label.no-entity-found', {
              entity: t('label.concept-plural'),
            })}
            metrics={metrics}
            selectedNodeId={selectedId}
            source={{
              kind: 'native',
              conflicts: treeConflicts,
              index: treeIndex,
              title: getEntityName(ontology),
              notice: renderTreeConflicts(),
            }}
            onConnect={canEditOntology ? connectNode : undefined}
            onSelect={selectNode}
          />
        </div>
      );
    }
    if (graphMode === 'data') {
      return <>{renderDataSurface()}</>;
    }

    return (
      <>
        {renderDataSurface()}
        <div
          aria-hidden="true"
          className={isAiMode ? AI_GRAPH_BACKDROP_CLASS : GRAPH_BACKDROP_CLASS}
        />
        {renderScopeNotice()}
        {scope.shownCount > 0 || !scope.isFocused ? (
          <Suspense fallback={<Loader />}>
            <OntologyGraphG6
              keepCanvasOnAdd
              studioMode
              canCreateRelationType={canCreateRelationType}
              checkRelation={issueFor}
              conflictEdgeKeys={conflictHighlight.edgeKeys}
              edges={scope.graph.edges}
              focusNodeId={selectedId ?? pendingFocusId}
              ghostNode={conceptGhost}
              glossaries={[]}
              glossaryColorMap={{}}
              graphSearchHighlight={searchHighlight}
              isEditMode={canCreateAxiom}
              nodePositions={nodePositions}
              nodes={graphNodes}
              ref={graphRef}
              relationColors={relationColors}
              relationTypeGroups={relationTypeGroups}
              selectedNodeId={selectedId}
              settings={SETTINGS}
              onCanvasDoubleClick={
                isEditing && canCreateNewClass ? placeConceptAt : undefined
              }
              onCreateRelation={async (fromId, toId, relationType) => {
                await createRelation(fromId, toId, relationType);
              }}
              onEdgeClick={(edge) => {
                // The graph reports its edge selection on every render; only a change is a click,
                // so a relationship opened from the concept panel is not closed by the next report.
                if (edge?.id === reportedEdgeId.current) {
                  return;
                }
                reportedEdgeId.current = edge?.id;
                if (edge?.id) {
                  runConfirmed(() =>
                    (onSelectedConceptChange ?? setLocalSelectedId)(undefined)
                  );
                  setRelationBackId(undefined);
                  setSelectedEdgeKey(edge.id);
                } else {
                  setSelectedEdgeKey(undefined);
                }
              }}
              onNodeClick={selectNode}
              onNodeDoubleClick={selectNode}
              onPaneClick={() => setSelectedId(undefined)}
            />
          </Suspense>
        ) : null}
        <OntologyGraphNodeList
          nodes={nodeListEntries}
          selectedId={selectedId}
          onOpen={selectNode}
        />
        {renderGraphControls()}
      </>
    );
  };

  const renderGraphMode = () => {
    if (surface !== 'graph') {
      return null;
    }

    return isAiMode ? (
      <OntologyGraphModeTabs mode={graphMode} onChange={changeGraphMode} />
    ) : (
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
            onPress={() => changeGraphMode(mode)}>
            {t(`label.${mode}`)}
          </Button>
        ))}
      </Box>
    );
  };

  const renderTypeDialog = () =>
    typeDraft ? (
      <RelationshipTypeDialog
        canLinkInverse={canLinkInverse}
        label={typeDraft.label}
        onCancel={() => typeDraft.resolve(undefined)}
        onSubmit={typeDraft.resolve}
      />
    ) : null;

  const isEmptyModel = model.concepts.length === 0;
  const canAddFirstConcept = [
    Boolean(onRequestCreateConcept),
    canEditOntology,
    !ontology.deleted,
    ...[
      ResourceEntity.ONTOLOGY_CONCEPT,
      ResourceEntity.ONTOLOGY_CHANGE_SET,
    ].map((resource) => flagsOf(resource).canCreate),
  ].every(Boolean);

  const renderEmptyCard = () =>
    [isEmptyModel, surface === 'graph', graphMode === 'model'].every(
      Boolean
    ) ? (
      <OntologyEmptyCard
        canAdd={canAddFirstConcept}
        onAdd={() => {
          if (!isEditing) {
            onRequestEdit?.();
          }
          onRequestCreateConcept?.();
        }}
      />
    ) : null;

  const renderMissingConcept = () =>
    selectedId && !selected ? (
      <div
        className="tw:absolute tw:top-16 tw:left-3.5 tw:z-6 tw:max-w-sm"
        data-testid="ontology-concept-not-found"
        role="alert">
        <Alert variant="warning">
          {t('message.ontology-concept-not-found', {
            version: t(releaseId ? 'label.published' : 'label.draft'),
          })}
        </Alert>
      </div>
    ) : null;

  const renderSearch = () => {
    const finder = (
      <OntologyConceptSearch
        opensUpward={Boolean(searchSlot)}
        results={searchResults}
        value={search}
        onChange={setSearch}
        onOpen={selectNode}
      />
    );
    if (searchSlot) {
      return createPortal(finder, searchSlot);
    }

    return (
      <div
        className={
          surface === 'tree'
            ? 'tw:px-6 tw:pt-4'
            : 'tw:absolute tw:left-3.5 tw:top-3.5 tw:z-6'
        }>
        {finder}
      </div>
    );
  };

  const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key === 'Escape' &&
      !event.defaultPrevented &&
      selected &&
      !conceptEditor
    ) {
      event.stopPropagation();
      setSelectedId(undefined);
    }
  };

  return (
    <RelationWarningContext.Provider value={warnFor}>
      {/* Escape bubbles up from whichever control opened or sits in the panel. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="tw:relative tw:flex tw:h-full tw:min-h-0 tw:w-full tw:overflow-hidden"
        ref={rootRef}
        onKeyDown={closeOnEscape}>
        <div className="tw:relative tw:isolate tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-col tw:overflow-hidden">
          {renderSearch()}
          {renderMissingConcept()}
          {renderGraphMode()}
          {renderSurface()}
          {renderCanvasCards()}
          {renderEmptyCard()}
        </div>
        {renderSidebar()}
        {renderTypeDialog()}
      </div>
    </RelationWarningContext.Provider>
  );
};

export default OntologyGraphView;
