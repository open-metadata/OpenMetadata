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

import { CreateOntology } from '../../../../generated/api/data/createOntology';
import { CreateOntologyChangeSet } from '../../../../generated/api/data/createOntologyChangeSet';
import {
  Format,
  Kind,
  NativeOntologyImportItem,
  NativeOntologyImportSummary,
  SkipReason,
  Status,
} from '../../../../generated/api/data/nativeOntologyImportSummary';
import type { Ontology } from '../../../../generated/entity/data/ontology';
import {
  detectNativeOntologyImportFormat,
  previewNativeOntologyImport,
  previewNativeOntologyImportWithoutTarget,
} from '../../../../rest/ontologyAPI';
import { generateUUID } from '../../../../utils/StringUtils';
import { getOwnersOrCurrentUser } from '../../../Glossary/AddGlossary/AddGlossary.utils';
import { GeneratedOntologyIdentity } from '../OntologyCreateForm/OntologyCreateForm.utils';

export const NATIVE_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const NATIVE_IMPORT_DETECT_WINDOW = 65_536;
export const NATIVE_IMPORT_ACCEPTED_EXTENSIONS =
  '.ttl,.rdf,.owl,.xml,.nt,.jsonld,.json,.csv';

const DRAFT_SEARCH_PARAM = 'draft';
const NAME_STEM_LIMIT = 40;

/**
 * The generated format enum is declared once per schema file, so enums from
 * different responses do not unify; their wire values do.
 */
export type NativeImportFormat = `${Format}`;

export const NATIVE_IMPORT_FORMAT_LABEL_KEYS: Record<
  NativeImportFormat,
  string
> = {
  [Format.CSV]: 'label.csv',
  [Format.Jsonld]: 'label.json-ld',
  [Format.Ntriples]: 'label.n-triples',
  [Format.Rdfxml]: 'label.rdf-xml',
  [Format.Turtle]: 'label.turtle',
};

export type NativeImportTarget = 'existing' | 'new';

export type NativeImportDetection =
  | { kind: 'idle' | 'pending' }
  | { kind: 'ready'; format?: NativeImportFormat }
  | { kind: 'failed'; message: string };

export type NativeImportParse =
  | { kind: 'idle' | 'pending' }
  | {
      kind: 'ready';
      summary: NativeOntologyImportSummary;
      changeSet?: CreateOntologyChangeSet;
      /** Ids of the items the user keeps ticked; only NEW and UPDATE items can be. */
      selection: ReadonlySet<string>;
    }
  | { kind: 'failed'; message: string };

export interface NativeImportState {
  readonly fileId: number;
  readonly parseId: number;
  readonly fileName?: string;
  readonly fileSize?: number;
  readonly target: NativeImportTarget;
  readonly detection: NativeImportDetection;
  readonly parse: NativeImportParse;
}

export type NativeImportAction =
  | { type: 'fileChosen'; token: number; fileName: string; fileSize?: number }
  | { type: 'fileCleared'; token: number }
  | { type: 'detected'; fileId: number; format?: NativeImportFormat }
  | { type: 'detectionFailed'; fileId: number; message: string }
  | { type: 'fileRejected'; token: number; message: string }
  | { type: 'parseStarted'; token: number }
  | {
      type: 'parsed';
      parseId: number;
      summary: NativeOntologyImportSummary;
      changeSet?: CreateOntologyChangeSet;
    }
  | { type: 'parseFailed'; parseId: number; message: string }
  | {
      type: 'selectionChanged';
      parseId: number;
      selection: ReadonlySet<string>;
    }
  | { type: 'targetChanged'; token: number; target: NativeImportTarget };

export const INITIAL_NATIVE_IMPORT_STATE: NativeImportState = {
  fileId: 0,
  parseId: 0,
  target: 'existing',
  detection: { kind: 'idle' },
  parse: { kind: 'idle' },
};

type FileAction = Extract<
  NativeImportAction,
  {
    type:
      | 'fileChosen'
      | 'fileCleared'
      | 'detected'
      | 'detectionFailed'
      | 'fileRejected';
  }
>;

const reduceFile = (
  state: NativeImportState,
  action: FileAction
): NativeImportState => {
  if (action.type === 'fileChosen') {
    return {
      ...state,
      fileId: action.token,
      parseId: action.token,
      fileName: action.fileName,
      fileSize: action.fileSize,
      detection: { kind: 'pending' },
      parse: { kind: 'idle' },
    };
  }
  if (action.type === 'fileRejected' || action.type === 'fileCleared') {
    return {
      ...state,
      fileId: action.token,
      parseId: action.token,
      fileName: undefined,
      fileSize: undefined,
      detection:
        action.type === 'fileRejected'
          ? { kind: 'failed', message: action.message }
          : { kind: 'idle' },
      parse: { kind: 'idle' },
    };
  }
  if (action.fileId !== state.fileId) {
    return state;
  }

  return {
    ...state,
    detection:
      action.type === 'detected'
        ? { kind: 'ready', format: action.format }
        : { kind: 'failed', message: action.message },
  };
};

/** NEW and UPDATE carry an operation; the rest only explain why nothing will change. */
export const isSelectableItem = (item: NativeOntologyImportItem) =>
  item.status === Status.New || item.status === Status.Update;

export const importItemsOf = (
  summary: NativeOntologyImportSummary
): readonly NativeOntologyImportItem[] => summary.items ?? [];

export const itemsOfKind = (
  items: readonly NativeOntologyImportItem[],
  kind: Kind
) => items.filter((item) => item.kind === kind);

export const initialSelection = (
  summary: NativeOntologyImportSummary
): ReadonlySet<string> =>
  new Set(
    importItemsOf(summary)
      .filter(isSelectableItem)
      .map(({ id }) => id)
  );

/** The NEW concepts of the same import that an item states a fact about. */
const requiredConcepts = (
  items: readonly NativeOntologyImportItem[],
  item: NativeOntologyImportItem
) =>
  (item.dependsOnIris ?? []).flatMap((iri) =>
    items.filter(
      (candidate) =>
        candidate.kind === Kind.Concept &&
        candidate.status === Status.New &&
        candidate.iri === iri
    )
  );

/** The unticked concept that blocks ticking this item, if any. */
export const unmetRequirement = (
  items: readonly NativeOntologyImportItem[],
  selection: ReadonlySet<string>,
  item: NativeOntologyImportItem
) =>
  requiredConcepts(items, item).find((concept) => !selection.has(concept.id));

export interface UntickedDependents {
  readonly name: string;
  readonly relationships: number;
  readonly rules: number;
  readonly properties: number;
}

/**
 * Unticks `ids`, and with each concept the relationships, rules and properties
 * that state a fact about it or name it in their domain or range, because applying one without the concept is refused.
 * Ticking the concept again leaves them unticked.
 */
export const untickWithDependents = (
  items: readonly NativeOntologyImportItem[],
  selection: ReadonlySet<string>,
  ids: readonly string[]
): {
  readonly selection: ReadonlySet<string>;
  readonly notices: readonly UntickedDependents[];
} => {
  const next = new Set(selection);
  const removed = new Set(ids);
  removed.forEach((id) => next.delete(id));
  const notices = items
    .filter(
      (item) =>
        removed.has(item.id) &&
        selection.has(item.id) &&
        item.kind === Kind.Concept &&
        item.iri
    )
    .flatMap((concept) => {
      const dependents = items.filter(
        (item) =>
          next.has(item.id) && item.dependsOnIris?.includes(concept.iri ?? '')
      );
      dependents.forEach(({ id }) => next.delete(id));

      return dependents.length === 0
        ? []
        : [
            {
              name: concept.label,
              relationships: dependents.filter(
                ({ kind }) => kind === Kind.Relationship
              ).length,
              rules: dependents.filter(({ kind }) => kind === Kind.Rule).length,
              properties: dependents.filter(
                ({ kind }) => kind === Kind.Property
              ).length,
            },
          ];
    });

  return { selection: next, notices };
};

const reduceParse = (
  state: NativeImportState,
  action: Exclude<NativeImportAction, FileAction>
): NativeImportState => {
  switch (action.type) {
    case 'targetChanged':
      return action.target === state.target
        ? state
        : {
            ...state,
            parseId: action.token,
            target: action.target,
            parse: { kind: 'idle' },
          };
    case 'parseStarted':
      return { ...state, parseId: action.token, parse: { kind: 'pending' } };
    case 'parsed':
      return action.parseId === state.parseId
        ? {
            ...state,
            parse: {
              kind: 'ready',
              summary: action.summary,
              changeSet: action.changeSet,
              selection: initialSelection(action.summary),
            },
          }
        : state;
    case 'selectionChanged':
      return action.parseId === state.parseId && state.parse.kind === 'ready'
        ? {
            ...state,
            parse: { ...state.parse, selection: action.selection },
          }
        : state;
    default:
      return action.parseId === state.parseId
        ? { ...state, parse: { kind: 'failed', message: action.message } }
        : state;
  }
};

const FILE_ACTIONS: ReadonlySet<string> = new Set([
  'fileChosen',
  'fileCleared',
  'fileRejected',
  'detected',
  'detectionFailed',
]);

const isFileAction = (action: NativeImportAction): action is FileAction =>
  FILE_ACTIONS.has(action.type);

/**
 * Every request takes a fresh token from the caller. A detection answer is
 * kept only for the file that asked, and a parse answer only for the latest
 * parse of the current file and target, so a slow answer for an older file or
 * target never replaces what the user sees now.
 */
export const nativeImportReducer = (
  state: NativeImportState,
  action: NativeImportAction
): NativeImportState =>
  isFileAction(action) ? reduceFile(state, action) : reduceParse(state, action);

export const NATIVE_IMPORT_ITEM_GROUPS = [
  { kind: Kind.Concept, labelKey: 'label.concept-plural' },
  { kind: Kind.Property, labelKey: 'label.property-plural' },
  { kind: Kind.Relationship, labelKey: 'label.relationship-plural' },
  { kind: Kind.Rule, labelKey: 'label.rule-plural' },
] as const satisfies readonly { kind: Kind; labelKey: string }[];

export const NATIVE_IMPORT_SKIP_REASON_LABEL_KEYS: Record<SkipReason, string> =
  {
    [SkipReason.ExtraValue]: 'label.skip-reason-extra-value',
    [SkipReason.Imports]: 'label.skip-reason-imports',
    [SkipReason.Individual]: 'label.skip-reason-individual',
    [SkipReason.NonPreferredLanguage]:
      'label.skip-reason-non-preferred-language',
    [SkipReason.UndeclaredReference]: 'label.skip-reason-undeclared-reference',
    [SkipReason.UnsupportedAnnotation]:
      'label.skip-reason-unsupported-annotation',
    [SkipReason.UnsupportedStructure]:
      'label.skip-reason-unsupported-structure',
  };

export const NATIVE_IMPORT_STATUS_LABEL_KEYS: Record<Status, string> = {
  [Status.AlreadyExists]: 'label.already-exists',
  [Status.Duplicate]: 'label.duplicate',
  [Status.New]: 'label.new',
  [Status.Skipped]: 'label.skipped',
  [Status.Update]: 'label.update',
};

/**
 * Keeps the operations of the chosen items. The preview names each operation
 * on its item, so an unticked item drops exactly its own operation.
 */
export const selectChanges = <T extends { operations?: { id?: string }[] }>(
  changeSet: T,
  summary: NativeOntologyImportSummary,
  selection: ReadonlySet<string>
): T => {
  const items = importItemsOf(summary);
  if (items.length === 0) {
    return changeSet;
  }
  const kept = new Set(
    items
      .filter((item) => selection.has(item.id) && item.operationId)
      .map((item) => item.operationId)
  );
  const operations = (changeSet.operations ?? []).filter(
    (operation) => operation.id !== undefined && kept.has(operation.id)
  );

  return { ...changeSet, operations, undoCursor: operations.length };
};

export const selectedCount = (
  summary: NativeOntologyImportSummary,
  selection: ReadonlySet<string>
) => importItemsOf(summary).filter(({ id }) => selection.has(id)).length;

export const hasImportableChanges = (summary: NativeOntologyImportSummary) => {
  const { counts } = summary;

  return (
    counts.newConcepts +
      counts.updatedConcepts +
      counts.newProperties +
      counts.updatedProperties +
      counts.newRelations >
    0
  );
};

/** Undefined when the preview has no item list, so the Import button keeps its plain label. */
export const itemImportCount = (
  summary: NativeOntologyImportSummary,
  selection: ReadonlySet<string>
) =>
  importItemsOf(summary).length > 0
    ? selectedCount(summary, selection)
    : undefined;

export type NativeImportSummaryPart =
  | 'new-concept'
  | 'updated-concept'
  | 'property'
  | 'relationship'
  | 'rule'
  | 'mapping';

const ITEM_SUMMARY_PART: Record<Kind, NativeImportSummaryPart> = {
  [Kind.Concept]: 'new-concept',
  [Kind.Property]: 'property',
  [Kind.Relationship]: 'relationship',
  [Kind.Rule]: 'rule',
};

const partOfItem = (item: NativeOntologyImportItem) =>
  item.kind === Kind.Concept && item.status === Status.Update
    ? 'updated-concept'
    : ITEM_SUMMARY_PART[item.kind];

/**
 * What the import will save, by kind. With an item list it counts the ticked
 * items; without one it falls back to the dry-run counts.
 */
export const importSummaryParts = (
  summary: NativeOntologyImportSummary,
  selection: ReadonlySet<string>
): readonly { part: NativeImportSummaryPart; count: number }[] => {
  const items = importItemsOf(summary);
  const { counts } = summary;
  const totals = new Map<NativeImportSummaryPart, number>(
    items.length > 0
      ? []
      : [
          ['new-concept', counts.newConcepts],
          ['updated-concept', counts.updatedConcepts],
          ['property', counts.newProperties + counts.updatedProperties],
          ['relationship', counts.newRelations],
          ['mapping', counts.newMappings],
        ]
  );
  items
    .filter(({ id }) => selection.has(id))
    .forEach((item) => {
      const part = partOfItem(item);
      totals.set(part, (totals.get(part) ?? 0) + 1);
    });

  return [...totals]
    .filter(([, count]) => count > 0)
    .map(([part, count]) => ({ part, count }));
};

export const hasSelectedChanges = (
  summary: NativeOntologyImportSummary,
  selection: ReadonlySet<string>
) =>
  importItemsOf(summary).length > 0
    ? selectedCount(summary, selection) > 0
    : hasImportableChanges(summary);

/** The one message the panel shows, in the order the steps can fail. */
export const nativeImportErrorMessage = (
  state: NativeImportState,
  installError?: string
) => {
  if (state.detection.kind === 'failed') {
    return state.detection.message;
  }

  return state.parse.kind === 'failed' ? state.parse.message : installError;
};

const fileStem = (fileName: string) => {
  const dot = fileName.lastIndexOf('.');

  return dot > 0 ? fileName.slice(0, dot) : fileName;
};

const slugOf = (text: string) =>
  text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, NAME_STEM_LIMIT)
    .replaceAll(/-+$/g, '');

/**
 * The create request for the ontology a file imports into. The name carries a
 * fresh UUID, so a retry after a lost response finds this ontology by its
 * name and IRI instead of creating a second one.
 */
export const nativeImportOntologyRequest = (
  label: string | undefined,
  fileName: string,
  userId: string,
  identityOf?: (title: string) => GeneratedOntologyIdentity | undefined
): CreateOntology => {
  const title = label?.trim() || fileStem(fileName);
  const identity = identityOf?.(title);
  if (identity) {
    return { ...identity, owners: getOwnersOrCurrentUser([], userId) };
  }
  const id = generateUUID();

  return {
    name: `${slugOf(title) || 'ontology'}-${id}`,
    displayName: title,
    iri: `urn:openmetadata:ontology:${id}`,
    namespace: `urn:openmetadata:ontology:${id}:`,
    owners: getOwnersOrCurrentUser([], userId),
  };
};

/** Opens the imported ontology: the page loads it from `?ontology=`. */
export const landOnImportedOntology = (
  current: URLSearchParams,
  ontologyId: string
) => {
  const next = new URLSearchParams(current);
  next.set('ontology', ontologyId);
  next.delete('concept');
  next.delete('scope');
  next.delete(DRAFT_SEARCH_PARAM);

  return next;
};

type Describe = (error: unknown) => string;

/**
 * Reads the file and asks the server which format it is. Returns the text so
 * the caller keeps it outside render state, and the format so it can dry-run
 * the file straight away; the answer goes through `dispatch` tagged with `fileId`.
 */
export const detectNativeImportFile = async (
  file: File,
  fileId: number,
  dispatch: (action: NativeImportAction) => void,
  describe: Describe
): Promise<{ text: string; format?: NativeImportFormat }> => {
  let text = '';
  try {
    text = await file.text();
    const detection = await detectNativeOntologyImportFormat({
      data: text.slice(0, NATIVE_IMPORT_DETECT_WINDOW + 1),
      fileName: file.name,
    });
    dispatch({ type: 'detected', fileId, format: detection.detectedFormat });

    return { text, format: detection.detectedFormat };
  } catch (error) {
    dispatch({ type: 'detectionFailed', fileId, message: describe(error) });

    return { text };
  }
};

/**
 * Dry-runs the file against the existing ontology, or against an empty target
 * when there is none. Nothing is written either way.
 */
export const parseNativeImportFile = async (
  request: { data: string; fileName?: string },
  parseId: number,
  ontology: Ontology | undefined,
  dispatch: (action: NativeImportAction) => void,
  describe: Describe
) => {
  try {
    if (!ontology) {
      const summary = await previewNativeOntologyImportWithoutTarget(request);
      dispatch({ type: 'parsed', parseId, summary });

      return;
    }
    const preview = await previewNativeOntologyImport(ontology.id, request);
    dispatch({
      type: 'parsed',
      parseId,
      summary: preview.summary,
      changeSet: preview.changeSet,
    });
  } catch (error) {
    dispatch({ type: 'parseFailed', parseId, message: describe(error) });
  }
};

export const selectionOf = (parse: NativeImportParse): ReadonlySet<string> =>
  parse.kind === 'ready' ? parse.selection : new Set();

/** Whether the user may press Import right now. */
export const canApplyImport = (
  state: NativeImportState,
  context: {
    canUseTarget: boolean;
    isBusy: boolean;
    isIdentityReady: boolean;
  }
) => {
  const hasChanges =
    state.parse.kind === 'ready' &&
    hasSelectedChanges(state.parse.summary, state.parse.selection);

  return (
    hasChanges &&
    context.canUseTarget &&
    context.isIdentityReady &&
    !context.isBusy
  );
};

/** The detected format, once the server has answered for the current file. */
export const detectedFormatOf = (state: NativeImportState) =>
  state.detection.kind === 'ready' ? state.detection.format : undefined;

export const hasReviewers = (ontology?: Ontology) =>
  Boolean(ontology?.reviewers?.length);

export const readySummaryOf = (state: NativeImportState) =>
  state.parse.kind === 'ready' ? state.parse.summary : undefined;

export const pick = <T>(condition: boolean, whenTrue: T, whenFalse: T) =>
  condition ? whenTrue : whenFalse;

export const isNewImportTarget = (
  state: NativeImportState,
  ontology?: Ontology
) => state.target === 'new' || !ontology;

export const importBusyOf = (
  state: NativeImportState,
  isInstalling: boolean
) => {
  const isParsing = state.parse.kind === 'pending';

  return { isParsing, isBusy: isParsing || isInstalling };
};

export const isFileChoiceDisabled = (
  isLockedOrBusy: boolean,
  canUseTarget: boolean
) => isLockedOrBusy || !canUseTarget;
