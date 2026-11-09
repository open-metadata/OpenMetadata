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
import { compare } from 'fast-json-patch';
import { DataAssetOption } from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import { ROUTES } from '../../../constants/constants';
import {
  CONTEXT_FILE_ENTITY_TYPE,
  MEMORY_STATUSES_AWAITING_DECISION,
  MEMORY_TYPE_OPTIONS,
} from '../../../constants/ContextCenter.constants';
import { EntityType } from '../../../enums/entity.enum';
import {
  ContextMemory,
  EntityReference,
  MemoryType,
  ShareVisibility,
} from '../../../generated/entity/context/contextMemory';
import { queryClient } from '../../../queryClient';
import {
  createContextMemory,
  getContextMemoryById,
  updateContextMemory,
} from '../../../rest/contextMemoryAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { CONTEXT_CENTER_MEMORIES_COUNT_QUERY_KEY } from '../../../utils/ContextCenterQueryKeys';
import { getEntityName } from '../../../utils/EntityNameUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getQueryPath } from '../../../utils/RouterUtils';
import { showSuccessToast } from '../../../utils/ToastUtils';
import {
  MemoryFormState,
  MemoryFormValues,
  SubmitMemoryCreateParams,
  SubmitMemoryUpdateParams,
} from './CreateMemoryModal.interface';

const MEMORY_LABEL_KEY = 'label.memory';

/**
 * The table a linked Query opens on: the memory's only linked table. With none or several, which
 * table the query belongs to is unknown.
 */
export const getQueryTableFqn = (
  assets: DataAssetOption[]
): string | undefined => {
  const tables = assets.filter(
    (asset) => asset.reference?.type === EntityType.TABLE
  );

  return tables.length === 1
    ? tables[0].reference.fullyQualifiedName
    : undefined;
};

/**
 * Where a linked asset opens, or undefined when it has nowhere to open. A Query has no page of its
 * own: it opens full screen on `tableFqn` (see getQueryTableFqn), and stays unlinked without one. A
 * document opens in Context Center. A type with no route of its own stays unlinked rather than
 * opening as a table.
 */
export const getLinkedAssetPath = (
  reference?: EntityReference,
  tableFqn?: string
): string | undefined => {
  if (!reference?.type || !reference.fullyQualifiedName) {
    return undefined;
  }
  if (reference.type === EntityType.QUERY) {
    return tableFqn && reference.id
      ? getQueryPath(tableFqn, reference.id)
      : undefined;
  }
  if (reference.type === CONTEXT_FILE_ENTITY_TYPE) {
    return reference.id
      ? contextCenterClassBase.getDocumentPath(reference.id)
      : undefined;
  }

  return entityUtilClassBase.hasEntityLink(reference.type)
    ? entityUtilClassBase.getEntityLink(
        reference.type,
        reference.fullyQualifiedName
      )
    : undefined;
};

/**
 * An admin decides a memory they view while it awaits approval, unless it is held for disputes: its
 * conflict review decides it, and approving here would leave both contradicting memories Approved.
 */
export const canDecideMemoryStatus = (
  memory: ContextMemory | undefined,
  isAdminUser: boolean,
  isViewOnly: boolean
): boolean =>
  isAdminUser &&
  isViewOnly &&
  !memory?.disputes?.length &&
  MEMORY_STATUSES_AWAITING_DECISION.some(
    (status) => status === memory?.entityStatus
  );

export const getAssetKey = (asset: DataAssetOption): string =>
  asset.reference?.fullyQualifiedName ?? String(asset.value ?? '');

// Removes the linked asset whose derived key matches `fqn` (mirrors the key
// used to render/select each `LinkedAssetCard`).
export const removeAssetByKey = (
  assets: DataAssetOption[],
  fqn: string
): DataAssetOption[] => assets.filter((asset) => getAssetKey(asset) !== fqn);

// The form offers only the types people choose by hand, so a stored type it
// cannot show (an agent's Learning) survives unless the editor picks another.
const resolveMemoryType = (
  stored: MemoryType | undefined,
  selected: MemoryType | undefined
): MemoryType | undefined =>
  selected ??
  (MEMORY_TYPE_OPTIONS.some((option) => option.id === stored)
    ? undefined
    : stored);

// Opening a successor keeps the Context Center's other query parameters; from
// anywhere else it starts fresh, so another page's parameters do not leak in.
export const getSuccessorSearch = (
  currentPathname: string,
  currentSearch: string,
  successorName: string
): string => {
  const params = new URLSearchParams(
    currentPathname === ROUTES.CONTEXT_CENTER_MEMORIES ? currentSearch : ''
  );
  params.set('memory', successorName);

  return params.toString();
};

// Patches only the fields that actually changed, preserving a pre-existing
// shareConfig — or adding one — only when there is a reason to (an existing
// config, or a visibility that differs from the default).
export const submitMemoryUpdate = async ({
  memoryToEdit,
  title,
  memory,
  memoryTypeValue,
  visibility,
  selectedTags,
  primaryEntity,
  relatedEntities,
  t,
  onUpdated,
}: SubmitMemoryUpdateParams): Promise<void> => {
  const hasExistingShareConfig =
    memoryToEdit.shareConfig?.visibility !== undefined;
  const original = {
    title: memoryToEdit.title ?? '',
    summary: memoryToEdit.summary ?? '',
    answer: memoryToEdit.answer,
    question: memoryToEdit.question,
    memoryType: memoryToEdit.memoryType,
    tags: memoryToEdit.tags ?? [],
    primaryEntity: memoryToEdit.primaryEntity,
    relatedEntities: (memoryToEdit.relatedEntities ?? []).map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      displayName: r.displayName,
      fullyQualifiedName: r.fullyQualifiedName,
    })),
    ...(hasExistingShareConfig
      ? {
          shareConfig: {
            visibility: memoryToEdit.shareConfig?.visibility,
          },
        }
      : {}),
  };
  const updated = {
    title: title.trim(),
    summary: '',
    answer: memory.trim(),
    question: memory.trim(),
    memoryType: resolveMemoryType(memoryToEdit.memoryType, memoryTypeValue),
    tags: selectedTags,
    primaryEntity,
    relatedEntities,
    ...(hasExistingShareConfig || visibility !== ShareVisibility.Private
      ? { shareConfig: { visibility } }
      : {}),
  };
  const patch = compare(original, updated);
  await updateContextMemory(memoryToEdit.id, patch);
  showSuccessToast(
    t('server.entity-updated-success', { entity: t(MEMORY_LABEL_KEY) })
  );
  onUpdated?.();
};

// Builds a URL-safe `name` from the title (falling back to the memory text)
// and omits optional fields the API defaults sensibly without.
export const submitMemoryCreate = async ({
  title,
  memory,
  memoryTypeValue,
  visibility,
  selectedTags,
  primaryEntity,
  relatedEntities,
  t,
  onCreated,
}: SubmitMemoryCreateParams): Promise<void> => {
  const name = (title.trim() || memory.trim())
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 64);

  await createContextMemory({
    name,
    question: memory.trim(),
    answer: memory.trim(),
    ...(title.trim() ? { title: title.trim() } : {}),
    ...(memoryTypeValue ? { memoryType: memoryTypeValue } : {}),
    ...(selectedTags.length > 0 ? { tags: selectedTags } : {}),
    ...(primaryEntity ? { primaryEntity } : {}),
    ...(relatedEntities.length > 0 ? { relatedEntities } : {}),
    shareConfig: { visibility },
  });
  queryClient.invalidateQueries({
    queryKey: CONTEXT_CENTER_MEMORIES_COUNT_QUERY_KEY,
  });

  showSuccessToast(
    t('server.create-entity-success', { entity: t(MEMORY_LABEL_KEY) })
  );
  onCreated();
};

// Splits the linked assets picked in the modal into the `primaryEntity` /
// `relatedEntities` shape the API expects, dropping any option that never
// resolved to a real entity reference.
export const getPrimaryAndRelatedEntities = (
  linkedAssets: DataAssetOption[]
): {
  primaryEntity: EntityReference | undefined;
  relatedEntities: EntityReference[];
} => {
  const validAssets = linkedAssets.filter(
    (a): a is DataAssetOption & { reference: EntityReference } =>
      Boolean(a.reference?.id && a.reference?.type)
  );
  const toRef = (
    a: DataAssetOption & { reference: EntityReference }
  ): EntityReference => ({
    id: a.reference.id,
    type: a.reference.type,
    name: a.reference?.name,
    displayName: a.reference?.displayName,
    fullyQualifiedName: a.reference?.fullyQualifiedName,
  });

  return {
    primaryEntity: validAssets[0] ? toRef(validAssets[0]) : undefined,
    relatedEntities: validAssets.slice(1).map(toRef),
  };
};

export const memoryEntityToAssetOption = (
  ref: EntityReference,
  t: (key: string) => string
): DataAssetOption => {
  const name = getEntityName(ref);

  return {
    label:
      name ||
      (ref.type === EntityType.QUERY ? t('message.no-permission-to-view') : ''),
    value: ref.fullyQualifiedName ?? ref.id,
    displayName: name,
    reference: ref,
  };
};

// Derives the RHF form values, tags, and linked-asset options from the memory
// being edited, so the edit modal opens pre-populated.
export const buildMemoryFormState = (
  memoryToEdit: ContextMemory,
  t: (key: string) => string
): MemoryFormState => {
  const memoryTypeOption = memoryToEdit.memoryType
    ? MEMORY_TYPE_OPTIONS.find((opt) => opt.id === memoryToEdit.memoryType)
    : undefined;

  const formValues: MemoryFormValues = {
    title: memoryToEdit.title ?? '',
    memory: memoryToEdit.answer ?? memoryToEdit.question ?? '',
    memoryType: memoryTypeOption
      ? { id: memoryTypeOption.id, label: t(memoryTypeOption.labelKey) }
      : null,
    visibility: memoryToEdit.shareConfig?.visibility ?? ShareVisibility.Private,
  };

  const assets: DataAssetOption[] = [
    ...(memoryToEdit.primaryEntity
      ? [memoryEntityToAssetOption(memoryToEdit.primaryEntity, t)]
      : []),
    ...(memoryToEdit.relatedEntities ?? []).map((ref) =>
      memoryEntityToAssetOption(ref, t)
    ),
  ];

  return { formValues, tags: memoryToEdit.tags ?? [], assets };
};

/**
 * Whether the stored memory moved on from the copy the panel read, which the decision's updatedAt
 * test refuses. Read again rather than parsed from the error, whose message is the patch library's.
 */
export const hasMemoryChangedSince = async (
  memory: ContextMemory
): Promise<boolean> => {
  try {
    const stored = await getContextMemoryById(memory.id);

    return stored.updatedAt !== memory.updatedAt;
  } catch {
    return false;
  }
};
