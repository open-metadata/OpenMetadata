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
import { MEMORY_TYPE_OPTIONS } from '../../../constants/ContextCenter.constants';
import {
  ContextMemory,
  EntityReference,
  ShareVisibility,
} from '../../../generated/entity/context/contextMemory';
import { queryClient } from '../../../queryClient';
import {
  createContextMemory,
  updateContextMemory,
} from '../../../rest/contextMemoryAPI';
import { CONTEXT_CENTER_MEMORIES_COUNT_QUERY_KEY } from '../../../utils/ContextCenterQueryKeys';
import { showSuccessToast } from '../../../utils/ToastUtils';
import {
  MemoryFormState,
  MemoryFormValues,
  SubmitMemoryCreateParams,
  SubmitMemoryUpdateParams,
} from './CreateMemoryModal.interface';

const MEMORY_LABEL_KEY = 'label.memory';

export const getAssetKey = (asset: DataAssetOption): string =>
  asset.reference?.fullyQualifiedName ?? String(asset.value ?? '');

// Removes the linked asset whose derived key matches `fqn` (mirrors the key
// used to render/select each `LinkedAssetCard`).
export const removeAssetByKey = (
  assets: DataAssetOption[],
  fqn: string
): DataAssetOption[] => assets.filter((asset) => getAssetKey(asset) !== fqn);

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
    memoryType: memoryTypeValue,
    tags: selectedTags,
    primaryEntity,
    relatedEntities,
    ...(hasExistingShareConfig || visibility !== ShareVisibility.Shared
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
  ref: EntityReference
): DataAssetOption => ({
  label: ref.displayName ?? ref.name ?? '',
  value: ref.fullyQualifiedName ?? ref.id,
  displayName: ref.displayName ?? ref.name ?? '',
  reference: ref,
});

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
    visibility: memoryToEdit.shareConfig?.visibility ?? ShareVisibility.Shared,
  };

  const assets: DataAssetOption[] = [
    ...(memoryToEdit.primaryEntity
      ? [memoryEntityToAssetOption(memoryToEdit.primaryEntity)]
      : []),
    ...(memoryToEdit.relatedEntities ?? []).map(memoryEntityToAssetOption),
  ];

  return { formValues, tags: memoryToEdit.tags ?? [], assets };
};
