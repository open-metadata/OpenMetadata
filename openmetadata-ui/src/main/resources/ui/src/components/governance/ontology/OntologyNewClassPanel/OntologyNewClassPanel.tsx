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
  Badge,
  Box,
  Button,
  ButtonUtility,
  Checkbox,
  Divider,
  FieldTypes,
  FormSelectItem,
  getField,
  HookForm,
  Input,
  Label,
  Select,
  Tag,
  TagGroup,
  TagList,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01, XClose } from '@openmetadata/ui-core-components/icons';
import { isAxiosError } from 'axios';
import {
  Fragment,
  MutableRefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { v4 as uuid } from 'uuid';
import { EntityType } from '../../../../enums/entity.enum';
import {
  ConceptMappingType,
  CreateOntologyChangeSet,
  OntologyConceptType,
} from '../../../../generated/api/data/createOntologyChangeSet';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { User } from '../../../../generated/entity/teams/user';
import { useOntologyChangeSetApply } from '../../../../hooks/governance/ontology/useOntologyChangeSetApply';
import {
  useOntologyDirtyForm,
  useOntologyDraftLock,
} from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  getOntologyState,
  hardDeleteOntologyDefinition,
  restoreOntologyDefinition,
} from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getEntityReferenceFromEntity } from '../../../../utils/EntityReferenceUtils';
import { isAbsoluteOntologyIri } from '../../../../utils/governance/ontology/OntologyAuthoring.utils';
import {
  buildNewClassChangeSet,
  NewClassDraft,
  OwnPropertyDraft,
} from '../../../../utils/governance/ontology/OntologyNativeChangeSet.utils';
import {
  OntologyStudioModel,
  StudioDatatype,
  STUDIO_DATATYPES,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import { showUndoToast } from '../../../../utils/governance/ontology/OntologyUndoToast';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { EntityReferenceOption } from '../../../Glossary/AddGlossary/AddGlossary.interface';
import {
  toEntityReferenceOption,
  toEntityReferences,
} from '../../../Glossary/AddGlossary/AddGlossary.utils';
import { useUserTeamOptions } from '../../../Glossary/hooks/useEntityReferenceOptions';
import { useMappingTargetOptions } from '../OntologyConceptEditor/useReadableConceptOptions';
import OntologyAdvancedToggle from '../OntologyCreateForm/OntologyAdvancedToggle';
import OntologyIriInput from '../OntologyIriInput/OntologyIriInput';
import OntologyStudioDrawer from '../OntologyStudioDrawer/OntologyStudioDrawer';
import {
  ClassIdentityIssue,
  classIdentityIssues,
  classIri,
  classLocalName,
  distinctChipValues,
  inheritedClassProperties,
  isValidMapping,
  isValidOwnProperty,
  MappingInput,
  mappingTypeLabel,
  ownPropertyDraft,
  ownPropertyTypeLabel,
} from './OntologyNewClassPanel.utils';
import { useDeletedConceptNamed } from './useDeletedConceptNamed';
const DATATYPE_LABEL_KEYS: Record<StudioDatatype | 'object', string> = {
  boolean: 'label.boolean',
  date: 'label.date',
  dateTime: 'label.date-time',
  decimal: 'label.decimal',
  enum: 'label.enum',
  integer: 'label.integer',
  object: 'label.object',
  string: 'label.string',
};
interface SelectionValues {
  parents: FormSelectItem[];
  equivalent: FormSelectItem[];
  disjoint: FormSelectItem[];
  owners: EntityReferenceOption[];
}

/** What the author typed, kept by the host while the panel remounts for another ontology. */
export interface CarriedConceptDraft {
  label: string;
  manualName?: string;
  description: string;
  conceptType: OntologyConceptType;
  customIri: string;
  source: string;
  abstract: boolean;
  advancedOpen: boolean;
  synonyms: string[];
  mappings: MappingInput[];
  /** Concepts of the ontology the draft was typed under; mappings to them do not carry over. */
  conceptIris: string[];
}
export interface OntologyFieldProps {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  draft?: MutableRefObject<CarriedConceptDraft | undefined>;
}
interface Props {
  ontology: Ontology;
  /** Set when the drawer is opened from All ontologies, where the target is not yet known. */
  ontologyField?: OntologyFieldProps;
  model: OntologyStudioModel;
  canCreate: boolean;
  canCreateProperty: boolean;
  canCreateAxiom: boolean;
  onBeforeCreate: () => void;
  onCreated: (iri: string, options: { keepOpen: boolean }) => Promise<boolean>;
  onUndone: () => void;
  onClose: () => void;
  onLockChange?: (locked: boolean) => void;
}
const emptySelections = (
  currentUser: User | undefined,
  youLabel: string
): SelectionValues => ({
  parents: [],
  equivalent: [],
  disjoint: [],
  owners: currentUser
    ? [
        {
          ...toEntityReferenceOption(
            getEntityReferenceFromEntity(currentUser, EntityType.USER)
          ),
          label:
            (currentUser.displayName ?? currentUser.name) +
            ' (' +
            youLabel +
            ')',
        },
      ]
    : [],
});
const restoreCarriedDraft = (
  carried: CarriedConceptDraft | undefined
): Omit<CarriedConceptDraft, 'conceptIris'> => ({
  label: carried?.label ?? '',
  manualName: carried?.manualName,
  description: carried?.description ?? '',
  conceptType: carried?.conceptType ?? OntologyConceptType.OwlClass,
  customIri: carried?.customIri ?? '',
  source: carried?.source ?? '',
  abstract: carried?.abstract ?? false,
  advancedOpen: carried?.advancedOpen ?? false,
  synonyms: carried?.synonyms ?? [],
  mappings: (carried?.mappings ?? []).filter(
    (mapping) => !carried?.conceptIris.includes(mapping.conceptIri)
  ),
});
// The server accepts only OWL_CLASS or BOTH as a class position
// (OntologyClassHierarchy.requireClass), and axioms and own properties put the
// new concept in one.
const hasOwlOnlyContent = (
  type: OntologyConceptType,
  hasAxioms: boolean,
  propertyCount: number
) =>
  type === OntologyConceptType.SkosConcept && (hasAxioms || propertyCount > 0);
const NAME_ISSUES: ClassIdentityIssue[] = ['name-invalid', 'name-taken'];
// An empty Display name takes the Name, so a clashing label is the Name's problem.
const fieldIssues = (displayName: string) =>
  displayName.trim()
    ? { name: NAME_ISSUES, label: ['label-taken'] as ClassIdentityIssue[] }
    : { name: [...NAME_ISSUES, 'label-taken' as const], label: [] };
const ISSUE_MESSAGES: Record<ClassIdentityIssue, string> = {
  'name-required': 'message.ontology-concept-name-required',
  'name-invalid': 'message.ontology-concept-name-invalid',
  'name-taken': 'message.ontology-concept-name-taken',
  'label-taken': 'message.ontology-concept-label-taken',
  'iri-invalid': 'message.invalid-concept-iri',
  'iri-taken': 'message.ontology-concept-iri-taken',
  'source-invalid': 'message.invalid-concept-iri',
};
const CONCEPT_TYPES: [OntologyConceptType, string][] = [
  [OntologyConceptType.OwlClass, 'label.class-owl'],
  [OntologyConceptType.SkosConcept, 'label.concept-skos'],
  [OntologyConceptType.Both, 'label.both-owl-skos'],
];

const CONCEPT_TYPE_HINTS: Record<OntologyConceptType, string> = {
  [OntologyConceptType.OwlClass]: 'message.ontology-concept-type-owl-hint',
  [OntologyConceptType.SkosConcept]: 'message.ontology-concept-type-skos-hint',
  [OntologyConceptType.Both]: 'message.ontology-concept-type-both-hint',
};

const SectionCaption = ({ children }: { children: string }) => (
  <Typography
    className="tw:uppercase tw:tracking-wide"
    color="secondary"
    size="text-xs"
    weight="semibold">
    {children}
  </Typography>
);

// The core TextArea forwards no test id to its <textarea>; tests and E2E specs address the field itself.
const tagDescriptionField = (element: HTMLTextAreaElement | null) =>
  element?.setAttribute('data-testid', 'new-class-description');

const OntologyNewClassPanel = ({
  ontology,
  ontologyField,
  model,
  canCreate,
  canCreateProperty,
  canCreateAxiom,
  onBeforeCreate,
  onCreated,
  onUndone,
  onClose,
  onLockChange,
}: Props) => {
  const { t } = useTranslation();
  const trigger = useRef(document.activeElement);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const opener = trigger.current;
    nameInput.current?.focus();

    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    };
  }, []);
  const currentUser = useApplicationStore((state) => state.currentUser);
  const ownerPicker = useUserTeamOptions();
  const defaultSelections = (): SelectionValues =>
    emptySelections(currentUser, t('label.you'));
  const form = useForm<SelectionValues>({
    defaultValues: defaultSelections(),
  });
  const selections = form.watch();
  const start = useRef(
    restoreCarriedDraft(ontologyField?.draft?.current)
  ).current;
  const [label, setLabel] = useState(start.label);
  const [manualName, setManualName] = useState<string | undefined>(
    start.manualName
  );
  const localName = manualName ?? classLocalName(label);
  const [description, setDescription] = useState(start.description);
  const [conceptType, setConceptType] = useState(start.conceptType);
  const [customIri, setCustomIri] = useState(start.customIri);
  const [source, setSource] = useState(start.source);
  const [abstract, setAbstract] = useState(start.abstract);
  const [advancedOpen, setAdvancedOpen] = useState(start.advancedOpen);
  const [synonyms, setSynonyms] = useState<string[]>(start.synonyms);
  const [synonym, setSynonym] = useState('');
  const [mappings, setMappings] = useState<MappingInput[]>(start.mappings);
  const [properties, setProperties] = useState<OwnPropertyDraft[]>([]);
  const [propertyName, setPropertyName] = useState('');
  const [datatype, setDatatype] = useState<StudioDatatype | 'object'>('string');
  const [range, setRange] = useState('');
  const [identifier, setIdentifier] = useState(false);
  const [enumInput, setEnumInput] = useState('');
  const [enumValues, setEnumValues] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [focusName, setFocusName] = useState(false);
  const [pressed, setPressed] = useState<'create' | 'another'>('create');
  const draftRef = ontologyField?.draft;
  useEffect(() => {
    if (draftRef) {
      draftRef.current = {
        abstract,
        advancedOpen,
        conceptIris: model.concepts.map((concept) => concept.iri),
        conceptType,
        customIri,
        description,
        label,
        manualName,
        mappings,
        source,
        synonyms,
      };
    }
  }, [
    abstract,
    advancedOpen,
    conceptType,
    customIri,
    description,
    draftRef,
    label,
    manualName,
    mappings,
    model.concepts,
    source,
    synonyms,
  ]);
  const attemptIri = useRef('');
  const attemptPlan = useRef<CreateOntologyChangeSet>();
  const addAnother = useRef(false);
  const submitting = useRef(false);
  const selectedIris = (items: FormSelectItem[]) =>
    items.map((item) => String(item.id));
  const needsAxioms = Boolean(
    selections.parents.length +
      selections.equivalent.length +
      selections.disjoint.length
  );
  const permitted = [
    canCreate,
    properties.length === 0 || canCreateProperty,
    !needsAxioms || canCreateAxiom,
  ].every(Boolean);
  const skosWithOwlOnly = hasOwlOnlyContent(
    conceptType,
    needsAxioms,
    properties.length
  );
  // Each mapping is an editable row, as the design draws them; a row left empty is skipped.
  const isUnresolvedRow = ({ conceptIri }: MappingInput) =>
    Boolean(conceptIri.trim()) && !isAbsoluteOntologyIri(conceptIri.trim());
  const isDuplicateRow = (index: number) =>
    isAbsoluteOntologyIri(mappings[index].conceptIri.trim()) &&
    !isValidMapping(
      mappings.slice(0, index).map((row) => ({
        ...row,
        conceptIri: row.conceptIri.trim(),
      })),
      mappings[index]
    );
  const mappingRowUnresolved = mappings.some(isUnresolvedRow);
  const [mappingCommitTried, setMappingCommitTried] = useState(false);
  const changeMapping = (index: number, change: Partial<MappingInput>) => {
    setMappings((previous) =>
      previous.map((row, position) =>
        position === index ? { ...row, ...change } : row
      )
    );
    setMappingCommitTried(false);
  };
  const [restoring, setRestoring] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const deletedConcept = useDeletedConceptNamed(ontology, model, localName);
  const issues = classIdentityIssues(model, {
    displayName: label,
    localName,
    iri: customIri,
    source,
  });
  const has = (...found: ClassIdentityIssue[]) =>
    found.some((issue) => issues.includes(issue));
  const issueText = (issue: ClassIdentityIssue) =>
    t(ISSUE_MESSAGES[issue], { name: localName.trim(), label: label.trim() });
  const fieldHint = (
    fallback: string | undefined,
    ...found: ClassIdentityIssue[]
  ) => {
    const issue = found.find((candidate) => issues.includes(candidate));

    return issue ? issueText(issue) : fallback;
  };
  const { name: nameFieldIssues, label: labelFieldIssues } = fieldIssues(label);
  // A reason a field already shows under itself is not repeated beside the buttons.
  const createBlock = (() => {
    if (ontologyField && !ontologyField.value) {
      return {
        isOnField: false,
        reason: t('message.ontology-concept-ontology-required'),
      };
    }
    if (!permitted) {
      return {
        isOnField: false,
        reason: t('message.no-permission-for-action'),
      };
    }
    if (issues.length > 0) {
      return {
        isOnField: issues[0] !== 'name-required',
        reason: issueText(issues[0]),
      };
    }
    if (deletedConcept) {
      return {
        isOnField: true,
        reason: t('message.ontology-concept-name-deleted', {
          name: localName.trim(),
        }),
      };
    }
    if (mappingRowUnresolved && mappingCommitTried) {
      return { isOnField: true, reason: t('message.invalid-concept-iri') };
    }

    return undefined;
  })();
  const blockedReason = createBlock?.reason;
  const valid = [blockedReason === undefined, !skosWithOwlOnly].every(Boolean);
  const effectiveIri = classIri(ontology.namespace ?? '', localName, customIri);

  const reconcileRef = useRef<() => Promise<void>>(async () => undefined);
  const dirty = [
    label,
    manualName,
    description,
    customIri,
    source,
    abstract,
    synonyms.length,
    synonym,
    mappings.length,
    properties.length,
    propertyName,
    range,
    identifier,
    enumInput,
    enumValues.length,
    datatype !== 'string',
    conceptType !== OntologyConceptType.OwlClass,
    form.formState.isDirty,
  ].some(Boolean);
  useEffect(() => {
    if (dirty) {
      setSaved(false);
    }
  }, [dirty]);
  const markSaved = useOntologyDirtyForm(dirty);
  const apply = useOntologyChangeSetApply({
    canApply: permitted,
    rebuildAfterFailure: true,
    onApplied: () => {
      markSaved();
      void reconcileRef.current();
    },
  });

  const resetForAnother = () => {
    setLabel('');
    setManualName(undefined);
    setDescription('');
    setConceptType(OntologyConceptType.OwlClass);
    setCustomIri('');
    setSource('');
    setAbstract(false);
    setSynonyms([]);
    setSynonym('');
    setMappings([]);
    setMappingCommitTried(false);
    setProperties([]);
    setPropertyName('');
    setDatatype('string');
    setRange('');
    setIdentifier(false);
    setEnumInput('');
    setEnumValues([]);
    form.reset(defaultSelections());
    apply.reset();
    setSaved(true);
    setFocusName(true);
  };

  const announceCreated = () => {
    const plan = attemptPlan.current;
    if (!plan) {
      return;
    }
    const name = plan.displayName ?? '';
    showUndoToast(t('message.ontology-concept-created', { name }), async () => {
      try {
        const ids = (type: 'concept' | 'property' | 'axiom') =>
          (plan.operations ?? []).flatMap((operation) => {
            const definition = {
              concept: operation.concept,
              property: operation.property,
              axiom: operation.axiom,
            }[type];

            return definition?.id ? [definition.id] : [];
          });
        for (const type of ['axiom', 'property', 'concept'] as const) {
          for (const id of ids(type)) {
            await hardDeleteOntologyDefinition(type, id); // NOSONAR ordered: axioms and properties reference the concept
          }
        }
        onUndone();
      } catch (undoError) {
        showErrorToast(
          isAxiosError(undoError) ? undoError : t('server.unexpected-error')
        );
      }
    });
  };

  const reconcile = async () => {
    setReconciling(true);
    setError(false);
    const keepOpen = addAnother.current;
    try {
      if (await onCreated(attemptIri.current, { keepOpen })) {
        announceCreated();
        if (keepOpen) {
          resetForAnother();
        }
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setReconciling(false);
    }
  };
  reconcileRef.current = reconcile;
  const leaveLocked = preparing || reconciling || apply.configurationLocked;
  useOntologyDraftLock(leaveLocked);
  const locked = leaveLocked || apply.status.kind === 'applied';
  useEffect(() => {
    if (focusName && !locked) {
      nameInput.current?.focus();
      setFocusName(false);
    }
  }, [focusName, locked]);
  useEffect(() => {
    onLockChange?.(leaveLocked);

    return () => onLockChange?.(false);
  }, [leaveLocked, onLockChange]);
  const removeSynonym = (value: string) =>
    setSynonyms((previous) => previous.filter((v) => v !== value));
  const removeProperty = (property: OwnPropertyDraft) =>
    setProperties((previous) => previous.filter((p) => p !== property));
  const removeMapping = (index: number) =>
    setMappings((previous) =>
      previous.filter((_row, position) => position !== index)
    );
  const propertyInput = {
    name: propertyName,
    datatype,
    range,
    isIdentifier: identifier,
    values: enumValues,
  };
  const rowValid = isValidOwnProperty(
    model,
    properties,
    localName,
    propertyInput
  );
  const canAddProperty = rowValid && !locked && canCreateProperty;
  const addProperty = () => {
    if (!canAddProperty) {
      return;
    }
    setProperties((previous) => [...previous, ownPropertyDraft(propertyInput)]);
    setPropertyName('');
    setEnumValues([]);
    setEnumInput('');
    setIdentifier(false);
  };
  const addMapping = () =>
    setMappings((previous) => [
      ...previous,
      { mappingType: ConceptMappingType.ExactMatch, conceptIri: '' },
    ]);
  const restoreDeleted = async () => {
    if (!deletedConcept || restoring) {
      return;
    }
    setRestoring(true);
    setRestoreFailed(false);
    try {
      await restoreOntologyDefinition('concept', deletedConcept.id);
      if (!(await onCreated(deletedConcept.iri, { keepOpen: false }))) {
        setError(true);
      }
    } catch {
      setRestoreFailed(true);
    } finally {
      setRestoring(false);
    }
  };
  const renderNameHint = () => {
    if (apply.status.kind === 'blocked' && apply.status.conflict) {
      return (
        <span data-testid="new-class-name-conflict">
          {apply.status.message}
        </span>
      );
    }
    if (deletedConcept && !has(...nameFieldIssues)) {
      return (
        <span data-testid="new-class-name-deleted">
          {restoreFailed
            ? t('server.unexpected-error')
            : t('message.ontology-concept-name-deleted', {
                name: localName.trim(),
              })}{' '}
          <Button
            color="link-color"
            data-testid="new-class-restore"
            isDisabled={locked}
            isLoading={restoring}
            size="sm"
            onPress={() => void restoreDeleted()}>
            {t('label.restore')}
          </Button>
        </span>
      );
    }

    return fieldHint(undefined, ...nameFieldIssues);
  };
  const canSubmit = [permitted, !locked].every(Boolean);
  const create = async (keepOpen: boolean) => {
    if (!canSubmit) {
      return;
    }
    if (mappingRowUnresolved) {
      setMappingCommitTried(true);

      return;
    }
    if (!valid || submitting.current) {
      return;
    }
    submitting.current = true;
    addAnother.current = keepOpen;
    setPressed(keepOpen ? 'another' : 'create');
    setPreparing(true);
    setError(false);
    try {
      const state = await getOntologyState(ontology.id);
      const pending = mappings.reduce<MappingInput[]>((kept, row) => {
        const candidate = { ...row, conceptIri: row.conceptIri.trim() };

        return isValidMapping(kept, candidate) ? [...kept, candidate] : kept;
      }, []);
      const draft: NewClassDraft = {
        label: label.trim() || localName.trim(),
        localName,
        iri: customIri,
        conceptType,
        mappings: pending,
        synonyms: distinctChipValues([...synonyms, synonym]),
        description,
        definitionSource: source,
        parentIris: selectedIris(selections.parents),
        equivalentIris: selectedIris(selections.equivalent),
        disjointIris: selectedIris(selections.disjoint),
        abstract,
        owners: toEntityReferences(selections.owners),
        ownProperties: properties,
      };
      const plan = buildNewClassChangeSet(
        ontology,
        draft,
        'class-' + uuid(),
        state.workingRevision
      );
      attemptIri.current = effectiveIri;
      attemptPlan.current = plan;
      onBeforeCreate();
      await apply.start(plan);
    } catch {
      setError(true);
    } finally {
      setPreparing(false);
      submitting.current = false;
    }
  };
  const localMappingTargets = useMemo(
    () =>
      model.concepts.map((c) => ({
        iri: c.iri,
        label: c.displayName ?? c.name,
        context: getEntityName(ontology),
      })),
    [model.concepts, ontology]
  );
  const { options: mappingTargets, isLoading: mappingTargetsLoading } =
    useMappingTargetOptions(localMappingTargets, !locked);
  const conceptOptions = model.concepts
    .filter((c) => c.conceptType !== OntologyConceptType.SkosConcept)
    .map((c) => ({
      id: c.iri,
      label: c.displayName ?? c.name,
    }));
  const inherited = inheritedClassProperties(
    model,
    selectedIris(selections.parents)
  );
  const renderChips = (values: string[], remove: (value: string) => void) =>
    values.map((value) => (
      <Box align="center" gap={1} key={value}>
        <Badge>{value}</Badge>
        <ButtonUtility
          icon={XClose}
          isDisabled={locked}
          size="xs"
          tooltip={t('label.remove-entity', { entity: value })}
          onClick={() => remove(value)}
        />
      </Box>
    ));

  const renderParentStatus = () => {
    if (selections.parents.length >= 2) {
      return (
        <Badge color="brand" data-testid="new-class-polyhierarchy">
          {t('label.polyhierarchy')}
        </Badge>
      );
    }
    if (selections.parents.length === 0) {
      return (
        <Typography size="text-xs">
          {t('message.ontology-top-level-class')}
        </Typography>
      );
    }

    return null;
  };
  const renderSubmit = () => {
    if (apply.status.kind === 'applied') {
      return (
        <Button isLoading={reconciling} onPress={() => void reconcile()}>
          {t('label.retry')}
        </Button>
      );
    }
    if (apply.outcomeUnknown) {
      return (
        <Button isDisabled={!permitted} onPress={() => void apply.retry()}>
          {t('label.retry')}
        </Button>
      );
    }
    const busy = preparing || apply.status.kind === 'busy';
    const disabled = !valid || locked;

    return (
      <Box gap={2} justify="end">
        <Button
          color="secondary"
          data-testid="new-class-create-another"
          isDisabled={disabled}
          isLoading={busy && pressed === 'another'}
          onPress={() => void create(true)}>
          {t('label.create-and-add-another')}
        </Button>
        <Button
          data-testid="new-class-create"
          isDisabled={disabled}
          isLoading={busy && pressed === 'create'}
          onPress={() => void create(false)}>
          {t('label.create')}
        </Button>
      </Box>
    );
  };
  const mappingRowError = (index: number) => {
    if (isDuplicateRow(index)) {
      return t('message.ontology-mapping-already-added');
    }

    return isUnresolvedRow(mappings[index]) && mappingCommitTried
      ? t('message.invalid-concept-iri')
      : undefined;
  };
  const renderMappings = () => (
    <Box direction="col" gap={3}>
      <Box align="start" gap={2} justify="between">
        <Box direction="col">
          <Typography size="text-sm" weight="semibold">
            {t('label.mapping-plural')}
          </Typography>
          <Typography color="secondary" size="text-xs">
            {t('message.ontology-concept-mappings-hint')}
          </Typography>
        </Box>
        <Button
          className="tw:shrink-0"
          color="link-color"
          data-testid="new-class-add-mapping"
          iconLeading={Plus}
          isDisabled={locked}
          size="sm"
          onPress={addMapping}>
          {t('label.add-mapping')}
        </Button>
      </Box>
      {mappings.map((mapping, index) => (
        <Box
          align="start"
          data-row={index}
          data-testid="new-class-mapping"
          gap={2}
          // Rows have no identity of their own until filled in; position is their key.
          // eslint-disable-next-line react/no-array-index-key
          key={index}>
          <Select
            aria-label={t('label.mapping-type')}
            className="tw:w-36 tw:shrink-0"
            isDisabled={locked}
            items={Object.values(ConceptMappingType).map((id) => ({
              id,
              label: mappingTypeLabel(id),
            }))}
            value={mapping.mappingType}
            onChange={(key) =>
              changeMapping(index, {
                mappingType: String(key) as ConceptMappingType,
              })
            }>
            {(item) => <Select.Item id={item.id} label={item.label} />}
          </Select>
          <Box className="tw:min-w-0 tw:flex-1" direction="col">
            <OntologyIriInput
              hideLabel
              error={mappingRowError(index)}
              isDisabled={locked}
              isLoading={mappingTargetsLoading}
              label={t('label.concept-iri')}
              options={mappingTargets}
              testId="new-class-mapping-iri"
              value={mapping.conceptIri}
              onChange={(conceptIri) => changeMapping(index, { conceptIri })}
              onInvalidCommit={() => setMappingCommitTried(true)}
            />
          </Box>
          <ButtonUtility
            className="tw:mt-1.5 tw:shrink-0"
            color="tertiary"
            data-testid="new-class-remove-mapping"
            icon={Trash01}
            isDisabled={locked}
            size="sm"
            tooltip={t('label.remove-entity', {
              entity: mapping.conceptIri || t('label.mapping'),
            })}
            onClick={() => removeMapping(index)}
          />
        </Box>
      ))}
    </Box>
  );
  const renderProperties = () => (
    <>
      <Typography className="tw:text-secondary" size="text-sm" weight="medium">
        {t('label.own-property-plural')}
      </Typography>
      {/* The design's rows: name, then its type in grey, removed with ×. */}
      {properties.map((property) => (
        <Box
          align="center"
          className="tw:rounded-lg tw:border tw:border-secondary tw:bg-surface tw:py-2 tw:pr-2 tw:pl-4"
          data-testid="new-class-own-property"
          gap={2}
          key={property.name}>
          <Typography ellipsis className="tw:text-primary" size="text-md">
            {property.name}
          </Typography>
          <Typography className="tw:shrink-0 tw:text-tertiary" size="text-sm">
            {property.kind === 'data'
              ? t(DATATYPE_LABEL_KEYS[property.datatype])
              : ownPropertyTypeLabel(property)}
            {property.isIdentifier ? ' · ' + t('label.identifier') : ''}
          </Typography>
          <ButtonUtility
            className="tw:ml-auto"
            color="tertiary"
            icon={XClose}
            isDisabled={locked}
            size="xs"
            tooltip={t('label.remove-entity', { entity: property.name })}
            onClick={() => removeProperty(property)}
          />
        </Box>
      ))}
      {/* The design's grey card: name and type on one row, Identifier and Add under them. */}
      <Box
        className="tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:p-3"
        data-testid="new-class-own-property-form"
        direction="col"
        gap={3}>
        <Box align="start" gap={2}>
          <Input
            aria-label={t('label.property-name')}
            className="tw:min-w-0 tw:flex-1"
            inputDataTestId="new-class-property-name"
            isDisabled={locked || !canCreateProperty}
            placeholder={t('label.property-name')}
            value={propertyName}
            onChange={setPropertyName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addProperty();
              }
            }}
          />
          <Select
            aria-label={t('label.type')}
            className="tw:w-36 tw:shrink-0"
            isDisabled={locked || !canCreateProperty}
            items={[...STUDIO_DATATYPES, 'object' as const].map((id) => ({
              id,
              label: t(DATATYPE_LABEL_KEYS[id]),
            }))}
            value={datatype}
            onChange={(key) =>
              setDatatype(String(key) as StudioDatatype | 'object')
            }>
            {(item) => <Select.Item id={item.id} label={item.label} />}
          </Select>
        </Box>
        {datatype === 'object' ? (
          <Select
            isDisabled={locked}
            items={conceptOptions}
            label={t('label.range')}
            value={range}
            onChange={(key) => setRange(String(key))}>
            {(item) => <Select.Item id={item.id} label={item.label} />}
          </Select>
        ) : null}
        {datatype === 'enum' ? (
          <>
            <Input
              inputDataTestId="new-class-enum-values"
              isDisabled={locked}
              label={t('label.allowed-values')}
              value={enumInput}
              onChange={(value) => {
                if (value.includes(',')) {
                  const parts = value.split(',');
                  setEnumValues((previous) =>
                    distinctChipValues([...previous, ...parts.slice(0, -1)])
                  );
                  setEnumInput(parts.at(-1) ?? '');
                } else {
                  setEnumInput(value);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  setEnumValues((previous) =>
                    distinctChipValues([...previous, enumInput])
                  );
                  setEnumInput('');
                }
              }}
            />
            <Box className="tw:flex-wrap" gap={1}>
              {renderChips(enumValues, (value) =>
                setEnumValues((previous) => previous.filter((v) => v !== value))
              )}
            </Box>
            <Typography size="text-xs">
              {t('message.ontology-enum-minimum')}
            </Typography>
          </>
        ) : null}
        <Box align="center" gap={2} justify="between">
          <Checkbox
            isDisabled={locked || !canCreateProperty}
            isSelected={identifier}
            label={t('label.identifier')}
            onChange={setIdentifier}
          />
          <Button
            color={canAddProperty ? 'primary' : 'secondary'}
            data-testid="new-class-add-property"
            isDisabled={!canAddProperty}
            size="sm"
            onPress={addProperty}>
            {t('label.add')}
          </Button>
        </Box>
      </Box>
    </>
  );
  const renderStatus = () => {
    if (dirty && apply.status.kind !== 'applied') {
      return t('label.unsaved-changes');
    }

    return saved || apply.status.kind === 'applied'
      ? t('label.all-changes-saved')
      : null;
  };
  const renderFooter = () => (
    <Box
      className="tw:sticky tw:bottom-0 tw:shrink-0 tw:border-t tw:border-secondary tw:bg-surface tw:p-4"
      direction="col"
      gap={2}>
      {error ? (
        <Alert variant="error">
          {apply.status.kind === 'applied'
            ? t('message.ontology-class-refresh-failed')
            : t('server.unexpected-error')}
        </Alert>
      ) : null}
      {apply.status.kind === 'blocked' && !apply.status.conflict ? (
        <Alert variant="error">{apply.status.message}</Alert>
      ) : null}
      <Box align="center" gap={3}>
        <Button
          color="tertiary"
          data-testid="new-class-cancel"
          isDisabled={leaveLocked}
          onPress={onClose}>
          {t('label.cancel')}
        </Button>
        {/* The design names what blocks Create beside the buttons, before the save status. */}
        <Box
          align="center"
          className="tw:min-w-0 tw:flex-1"
          gap={2}
          justify="end">
          {createBlock &&
          !createBlock.isOnField &&
          apply.status.kind !== 'applied' ? (
            <Typography
              color="secondary"
              data-testid="new-class-create-reason"
              size="text-sm">
              {createBlock.reason}
            </Typography>
          ) : null}
          <Typography
            color="secondary"
            data-testid="new-class-save-status"
            role="status"
            size="text-xs">
            {renderStatus()}
          </Typography>
        </Box>
        {renderSubmit()}
      </Box>
    </Box>
  );
  const renderAdvanced = () => (
    <>
      <OntologyAdvancedToggle
        hideHint
        controls="new-class-advanced"
        isOpen={advancedOpen}
        testId="new-class-advanced-toggle"
        onToggle={() => setAdvancedOpen((open) => !open)}
      />
      {advancedOpen ? (
        <Box
          data-testid="new-class-advanced"
          direction="col"
          gap={4}
          id="new-class-advanced">
          <SectionCaption>{t('label.axiom-plural')}</SectionCaption>
          {(
            [
              { name: 'parents', label: t('label.subclass-of') },
              { name: 'equivalent', label: t('label.equivalent-to') },
              { name: 'disjoint', label: t('label.disjoint-with') },
            ] as const
          ).map((field) => (
            <Fragment key={field.name}>
              {getField({
                name: field.name,
                label: field.label,
                type: FieldTypes.MULTI_SELECT,
                props: {
                  items: conceptOptions,
                  isDisabled: locked || !canCreateAxiom,
                },
              })}
            </Fragment>
          ))}
          {renderParentStatus()}
          <Checkbox
            isDisabled={locked}
            isSelected={abstract}
            label={t('label.abstract')}
            onChange={setAbstract}
          />
          <Divider />
          <SectionCaption>{t('label.property-plural')}</SectionCaption>
          <Typography
            className="tw:text-secondary"
            size="text-sm"
            weight="medium">
            {t('label.inherited-property-plural')}
          </Typography>
          {inherited.map(({ property, parent }) => (
            <Typography key={property.id} size="text-xs">
              {property.displayName ?? property.name} ·{' '}
              {t('label.from-parent', {
                parent: parent.displayName ?? parent.name,
              })}
            </Typography>
          ))}
          {renderProperties()}
          <Divider />
          <SectionCaption>{t('label.governance')}</SectionCaption>
          <Input
            isReadOnly
            label={t('label.layer')}
            value={
              ontology.layer === 'L2'
                ? 'L2 ' + t('label.industry')
                : ontology.layer ?? ''
            }
          />
          {getField({
            name: 'owners',
            label: t('label.owner-plural'),
            type: FieldTypes.USER_TEAM_SELECT_INPUT,
            props: {
              ...ownerPicker,
              multiple: true,
              filterOption: () => true,
              isDisabled: locked,
            },
          })}
        </Box>
      ) : null}
    </>
  );
  const renderPanel = () => (
    <OntologyStudioDrawer
      ariaLabel={t('label.new-entity', {
        entity: t('label.concept').toLocaleLowerCase(),
      })}
      testId="ontology-new-class-panel"
      onInteractOutside={onClose}>
      <Box
        align="center"
        className="tw:sticky tw:top-0 tw:shrink-0 tw:border-b tw:border-secondary tw:px-6 tw:py-4"
        justify="between">
        <Box direction="col">
          <Typography
            color="secondary"
            data-testid="new-class-in-ontology"
            size="text-sm"
            weight="medium">
            {t('label.in-entity', { entity: getEntityName(ontology) })}
          </Typography>
          <Typography
            as="h2"
            className="not-prose tw:m-0 tw:text-primary"
            size="text-lg"
            weight="semibold">
            {t('label.new-entity', {
              entity: t('label.concept').toLocaleLowerCase(),
            })}
          </Typography>
        </Box>
        <ButtonUtility
          data-testid="ontology-new-class-close"
          icon={XClose}
          isDisabled={leaveLocked}
          size="sm"
          tooltip={t('label.close')}
          onClick={onClose}
        />
      </Box>
      <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-6 tw:py-5">
        <HookForm form={form} onSubmit={(event) => event.preventDefault()}>
          <Box direction="col" gap={4}>
            <SectionCaption>{t('label.identity')}</SectionCaption>
            {ontologyField ? (
              <div data-testid="new-class-ontology">
                <Select
                  isRequired
                  isDisabled={locked}
                  items={ontologyField.options}
                  label={t('label.ontology')}
                  value={ontologyField.value}
                  onChange={(key) => ontologyField.onChange(String(key))}>
                  {(item) => <Select.Item id={item.id} label={item.label} />}
                </Select>
              </div>
            ) : null}
            <Input
              isRequired
              hint={renderNameHint()}
              inputDataTestId="new-class-local-name"
              isDisabled={locked}
              isInvalid={
                has(...nameFieldIssues) ||
                Boolean(deletedConcept) ||
                (apply.status.kind === 'blocked' && apply.status.conflict)
              }
              label={t('label.name')}
              ref={nameInput}
              value={localName}
              onChange={setManualName}
            />
            <Input
              hint={fieldHint(
                t('message.ontology-concept-display-name-hint'),
                ...labelFieldIssues
              )}
              inputDataTestId="new-class-label"
              isDisabled={locked}
              isInvalid={has(...labelFieldIssues)}
              label={t('label.ontology-display-name')}
              placeholder={localName}
              value={label}
              onChange={setLabel}
            />
            {/* Chips sit inside the field, as the design draws it; the frame is layout around a
                borderless core Input. */}
            <Box direction="col" gap={2}>
              <Label id="new-class-synonyms-label">
                {t('label.synonym-plural')}
              </Label>
              <Box
                align="center"
                className="tw:min-h-10 tw:flex-wrap tw:rounded-lg tw:border tw:border-primary tw:bg-surface tw:px-2 tw:py-1 tw:shadow-xs tw:focus-within:border-brand"
                data-testid="new-class-synonym-field"
                gap={2}>
                {synonyms.length > 0 ? (
                  <TagGroup label={t('label.synonym-plural')} size="md">
                    <TagList className="tw:flex tw:flex-wrap tw:gap-1.5">
                      {synonyms.map((value) => (
                        <Tag
                          id={value}
                          isDisabled={locked}
                          key={value}
                          onClose={() => removeSynonym(value)}>
                          {value}
                        </Tag>
                      ))}
                    </TagList>
                  </TagGroup>
                ) : null}
                <Input
                  borderless
                  aria-labelledby="new-class-synonyms-label"
                  className="tw:min-w-24 tw:flex-1"
                  inputDataTestId="new-class-synonyms"
                  isDisabled={locked}
                  placeholder={
                    synonyms.length > 0
                      ? undefined
                      : t('message.ontology-synonym-placeholder')
                  }
                  value={synonym}
                  onChange={(value) => {
                    if (value.includes(',')) {
                      const parts = value.split(',');
                      setSynonyms((previous) =>
                        distinctChipValues([...previous, ...parts.slice(0, -1)])
                      );
                      setSynonym(parts.at(-1) ?? '');
                    } else {
                      setSynonym(value);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      setSynonyms((previous) =>
                        distinctChipValues([...previous, synonym])
                      );
                      setSynonym('');
                    } else if (
                      event.key === 'Backspace' &&
                      !synonym &&
                      synonyms.length > 0
                    ) {
                      setSynonyms((previous) => previous.slice(0, -1));
                    }
                  }}
                />
              </Box>
            </Box>
            <div data-testid="new-class-type">
              <Select
                hint={t(CONCEPT_TYPE_HINTS[conceptType])}
                isDisabled={locked}
                items={CONCEPT_TYPES.map(([id, key]) => ({
                  id,
                  label: t(key),
                }))}
                label={t('label.type')}
                value={conceptType}
                onChange={(value) =>
                  setConceptType(value as OntologyConceptType)
                }>
                {(item) => (
                  <Select.Item
                    data-testid={'new-class-type-' + item.id}
                    id={item.id}
                    label={item.label}
                  />
                )}
              </Select>
            </div>
            {skosWithOwlOnly ? (
              <Typography
                color="danger"
                data-testid="new-class-skos-owl-only"
                role="alert"
                size="text-xs">
                {t('message.ontology-concept-skos-owl-only')}
              </Typography>
            ) : null}
            <Input
              hint={fieldHint(
                t('message.ontology-concept-iri-hint'),
                'iri-invalid',
                'iri-taken'
              )}
              inputDataTestId="new-class-iri-input"
              isDisabled={locked}
              isInvalid={has('iri-invalid', 'iri-taken')}
              label={t('label.concept-iri')}
              placeholder={effectiveIri}
              value={customIri}
              onChange={setCustomIri}
            />
            <Typography
              className="tw:break-all"
              data-testid="new-class-iri"
              size="text-xs">
              {effectiveIri}
            </Typography>
            <Divider />
            <SectionCaption>{t('label.definition')}</SectionCaption>
            <TextArea
              isDisabled={locked}
              label={t('label.description')}
              placeholder={t('message.concept-description-placeholder')}
              rows={3}
              size="sm"
              textAreaRef={tagDescriptionField}
              value={description}
              onChange={setDescription}
            />
            <Input
              hint={fieldHint(undefined, 'source-invalid')}
              inputDataTestId="new-class-source"
              isDisabled={locked}
              isInvalid={has('source-invalid')}
              label={t('label.definition-source')}
              value={source}
              onChange={setSource}
            />
            {renderMappings()}
            {renderAdvanced()}
            <Alert variant="brand">
              {t('message.ontology-class-draft-notice')}
            </Alert>
          </Box>
        </HookForm>
      </div>
      {renderFooter()}
    </OntologyStudioDrawer>
  );

  return renderPanel();
};

export default OntologyNewClassPanel;
