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
  NativeOntologyImportSummary,
} from '../../../../generated/api/data/nativeOntologyImportSummary';
import type { Ontology } from '../../../../generated/entity/data/ontology';
import {
  detectNativeOntologyImportFormat,
  previewNativeOntologyImport,
  previewNativeOntologyImportWithoutTarget,
} from '../../../../rest/ontologyAPI';
import { generateUUID } from '../../../../utils/StringUtils';
import { getOwnersOrCurrentUser } from '../../../Glossary/AddGlossary/AddGlossary.utils';

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

export type NativeImportStep = 'drop' | 'parse' | 'import';

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
    }
  | { kind: 'failed'; message: string };

export interface NativeImportState {
  readonly fileId: number;
  readonly parseId: number;
  readonly fileName?: string;
  readonly target: NativeImportTarget;
  readonly detection: NativeImportDetection;
  readonly parse: NativeImportParse;
}

export type NativeImportAction =
  | { type: 'fileChosen'; token: number; fileName: string }
  | { type: 'detected'; fileId: number; format?: NativeImportFormat }
  | { type: 'detectionFailed'; fileId: number; message: string }
  | { type: 'parseStarted'; token: number }
  | {
      type: 'parsed';
      parseId: number;
      summary: NativeOntologyImportSummary;
      changeSet?: CreateOntologyChangeSet;
    }
  | { type: 'parseFailed'; parseId: number; message: string }
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
  { type: 'fileChosen' | 'detected' | 'detectionFailed' }
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
      detection: { kind: 'pending' },
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
            },
          }
        : state;
    default:
      return action.parseId === state.parseId
        ? { ...state, parse: { kind: 'failed', message: action.message } }
        : state;
  }
};

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
  action.type === 'fileChosen' ||
  action.type === 'detected' ||
  action.type === 'detectionFailed'
    ? reduceFile(state, action)
    : reduceParse(state, action);

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

export const nativeImportStep = (
  state: NativeImportState
): NativeImportStep => {
  if (!state.fileName) {
    return 'drop';
  }

  return state.parse.kind === 'ready' ? 'import' : 'parse';
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
  userId: string
): CreateOntology => {
  const id = generateUUID();
  const title = label?.trim() || fileStem(fileName);

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
 * the caller keeps it outside render state; the answer goes through `dispatch`
 * tagged with `fileId`.
 */
export const detectNativeImportFile = async (
  file: File,
  fileId: number,
  dispatch: (action: NativeImportAction) => void,
  describe: Describe
) => {
  let text = '';
  try {
    text = await file.text();
    const detection = await detectNativeOntologyImportFormat({
      data: text.slice(0, NATIVE_IMPORT_DETECT_WINDOW + 1),
      fileName: file.name,
    });
    dispatch({ type: 'detected', fileId, format: detection.detectedFormat });
  } catch (error) {
    dispatch({ type: 'detectionFailed', fileId, message: describe(error) });
  }

  return text;
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

/** Which of Parse and Import the user may press right now. */
export const nativeImportActionFlags = (
  state: NativeImportState,
  context: {
    canUseTarget: boolean;
    isBusy: boolean;
    isLockedOrBusy: boolean;
  }
) => {
  const format =
    state.detection.kind === 'ready' ? state.detection.format : undefined;
  const summary =
    state.parse.kind === 'ready' ? state.parse.summary : undefined;

  return {
    canParse:
      Boolean(state.fileName && format) &&
      context.canUseTarget &&
      !context.isLockedOrBusy,
    canImport:
      Boolean(summary && hasImportableChanges(summary)) &&
      context.canUseTarget &&
      !context.isBusy,
  };
};

export const hasReviewers = (ontology?: Ontology) =>
  Boolean(ontology?.reviewers?.length);

export const readySummaryOf = (state: NativeImportState) =>
  state.parse.kind === 'ready' ? state.parse.summary : undefined;

export const pick = <T>(condition: boolean, whenTrue: T, whenFalse: T) =>
  condition ? whenTrue : whenFalse;
