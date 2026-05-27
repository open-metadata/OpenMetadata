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
  Badge,
  BadgeWithButton,
  Button,
  ButtonUtility,
  Card,
  Dialog,
  Dot,
  Input,
  Modal,
  ModalOverlay,
  Select,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { Lightbulb03, Plus, Share07, Trash01, X } from '@untitledui/icons';
import { ConfigProvider } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import { DataAssetOption } from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import DataAssetSelectList from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetSelectList';
import TagSelectForm from '../../../components/Tag/TagsSelectForm/TagsSelectForm.component';
import { MEMORY_TYPE_OPTIONS } from '../../../constants/ContextCenter.constants';
import { SearchIndex } from '../../../enums/search.enum';
import {
  LabelType,
  MemoryType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/entity/context/contextMemory';
import {
  createContextMemory,
  deleteContextMemory,
  updateContextMemory,
} from '../../../rest/contextMemoryAPI';
import { formatDate } from '../../../utils/date-time/DateTimeUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import tagClassBase from '../../../utils/TagClassBase';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { CreateMemoryModalProps } from './CreateMemoryModal.interface';

const LinkedAssetCard: FC<{
  asset: DataAssetOption;
  onRemove?: (fqn: string) => void;
}> = ({ asset, onRemove }) => {
  const displayName =
    asset.displayName || (typeof asset.label === 'string' ? asset.label : '');

  const fqn = asset.reference?.fullyQualifiedName ?? String(asset.value ?? '');

  return (
    <Card className="tw:flex tw:items-center tw:gap-3 tw:p-3">
      <div className="tw:shrink-0">
        {searchClassBase.getEntityIcon(
          asset.reference?.type ?? '',
          'tw:w-8 tw:h-8 tw:text-gray-500'
        )}
      </div>
      <div className="tw:flex tw:flex-1 tw:justify-between tw:items-center tw:min-w-0">
        <div className="tw:min-w-0 tw:flex-1 tw:pr-2">
          <Typography ellipsis size="text-sm" weight="medium">
            {displayName}
          </Typography>
          <Typography ellipsis className="tw:text-gray-400" size="text-xs">
            {asset.reference?.fullyQualifiedName ?? ''}
          </Typography>
        </div>
        <div className="tw:flex tw:items-center tw:gap-2 tw:shrink-0">
          {asset.reference?.type && (
            <Badge
              className="tw:uppercase"
              color="gray"
              size="sm"
              type="modern">
              {asset.reference.type}
            </Badge>
          )}
          {onRemove && (
            <ButtonUtility
              color="tertiary"
              icon={<X size={18} strokeWidth={2} />}
              onClick={() => onRemove(fqn)}
            />
          )}
        </div>
      </div>
    </Card>
  );
};

const EmptyLinkedAssets: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="tw:p-3 tw:border-dashed tw:border tw:rounded-lg tw:border-gray-300 tw:flex tw:justify-center tw:items-center">
      <Typography className="tw:text-gray-400" size="text-sm">
        {t('label.not-linked-to-any-data-asset')}
      </Typography>
    </div>
  );
};

const LinkedAssetsReadOnly: FC<{ assets: DataAssetOption[] }> = ({
  assets,
}) => {
  if (assets.length === 0) {
    return <EmptyLinkedAssets />;
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-2">
      {assets.map((asset) => (
        <LinkedAssetCard
          asset={asset}
          key={asset.reference?.fullyQualifiedName ?? String(asset.value ?? '')}
        />
      ))}
    </div>
  );
};

const CreateMemoryModal: FC<CreateMemoryModalProps> = ({
  memoryToEdit,
  isOpen,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
  viewOnly = false,
}) => {
  const { t } = useTranslation();
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const isEditMode = Boolean(memoryToEdit) && !viewOnly;

  let modalTitle = t('label.add-entity', { entity: t('label.memory') });
  if (isEditMode) {
    modalTitle = t('label.edit-entity', { entity: t('label.memory') });
  } else if (viewOnly) {
    modalTitle =
      memoryToEdit?.title ||
      t('label.edit-entity', { entity: t('label.memory') });
  }

  const submitLabel = isEditMode
    ? t('label.save-entity', { entity: t('label.change-plural') })
    : t('label.create-entity', { entity: t('label.memory') });

  const [title, setTitle] = useState('');
  const [memory, setMemory] = useState('');
  const [memoryType, setMemoryType] = useState<MemoryType | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [linkedAssets, setLinkedAssets] = useState<DataAssetOption[]>([]);

  const [selectedTags, setSelectedTags] = useState<TagLabel[]>([]);
  const [showTagForm, setShowTagForm] = useState(false);

  useEffect(() => {
    if (memoryToEdit) {
      setTitle(memoryToEdit.title ?? '');
      setMemory(memoryToEdit.answer || memoryToEdit.question);
      setMemoryType(memoryToEdit.memoryType ?? '');
      setSelectedTags(memoryToEdit.tags ?? []);
      const assetOptions: DataAssetOption[] = (
        memoryToEdit.relatedEntities ?? []
      ).map((ref) => ({
        label: ref.displayName ?? ref.name ?? '',
        value: ref.fullyQualifiedName ?? ref.id,
        displayName: ref.displayName ?? ref.name ?? '',
        reference: ref,
      }));
      setLinkedAssets(assetOptions);
    } else {
      setTitle('');
      setMemory('');
      setMemoryType('');
      setSelectedTags([]);
      setLinkedAssets([]);
    }
    setShowTagForm(false);
  }, [memoryToEdit]);

  const handleClose = () => {
    setTitle('');
    setMemory('');
    setMemoryType('');
    setLinkedAssets([]);
    setSelectedTags([]);
    setShowTagForm(false);
    onClose();
  };

  const isSubmitDisabled = memory.trim() === '';

  const handleAssetChange = useCallback(
    (option: DataAssetOption | DataAssetOption[]) => {
      const options = Array.isArray(option) ? option : [option];
      setLinkedAssets(options);
    },
    []
  );

  const handleTagSave = useCallback(
    async (tags: DefaultOptionType | DefaultOptionType[]) => {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      const newTags: TagLabel[] = tagArray.map((tag) => ({
        tagFQN: typeof tag === 'string' ? tag : String(tag.value ?? ''),
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
        style: tag.data.style,
      }));
      setSelectedTags(newTags);
      setShowTagForm(false);
    },
    []
  );

  const handleRemoveTag = useCallback((tagFQN: string) => {
    setSelectedTags((prev) => prev.filter((tag) => tag.tagFQN !== tagFQN));
  }, []);

  const fetchTagOptions = useCallback(
    (searchText: string, page: number) =>
      tagClassBase.getTags(searchText, page),
    []
  );

  const handleSubmit = async () => {
    if (isSubmitDisabled) {
      return;
    }

    setIsSubmitting(true);
    try {
      const relatedEntities = linkedAssets
        .filter((a) => a.reference?.id && a.reference?.type)
        .map((a) => ({
          id: a.reference!.id,
          type: a.reference!.type,
          name: a.reference?.name,
          displayName: a.reference?.displayName,
          fullyQualifiedName: a.reference?.fullyQualifiedName,
        }));

      if (isEditMode && memoryToEdit) {
        const originalRelatedEntities = (
          memoryToEdit.relatedEntities ?? []
        ).map((r) => ({
          id: r.id,
          type: r.type,
          name: r.name,
          displayName: r.displayName,
          fullyQualifiedName: r.fullyQualifiedName,
        }));
        const original = {
          title: memoryToEdit.title ?? '',
          summary: memoryToEdit.summary ?? '',
          answer: memoryToEdit.answer,
          question: memoryToEdit.question,
          memoryType: memoryToEdit.memoryType,
          tags: memoryToEdit.tags ?? [],
          relatedEntities: originalRelatedEntities,
        };
        const updated = {
          title: title.trim(),
          summary: '',
          answer: memory.trim(),
          question: memory.trim(),
          memoryType: memoryType || undefined,
          tags: selectedTags,
          relatedEntities,
        };
        const patch = compare(original, updated);
        await updateContextMemory(memoryToEdit.id, patch);
        showSuccessToast(
          t('server.entity-updated-successfully', { entity: t('label.memory') })
        );
        onUpdated?.();
      } else {
        const name = (title.trim() || memory.trim())
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 64);

        await createContextMemory({
          name,
          question: memory.trim(),
          answer: memory.trim(),
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(memoryType ? { memoryType } : {}),
          ...(selectedTags.length > 0 ? { tags: selectedTags } : {}),
          ...(relatedEntities.length > 0 ? { relatedEntities } : {}),
        });

        showSuccessToast(
          t('server.create-entity-success', { entity: t('label.memory') })
        );
        onCreated();
      }
      handleClose();
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!memoryToEdit) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteContextMemory(memoryToEdit.id);
      showSuccessToast(
        t('server.entity-deleted-successfully', { entity: t('label.memory') })
      );
      onDeleted?.();
      handleClose();
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      style={{ zIndex: 999 }}
      onOpenChange={(open) => !open && handleClose()}>
      <Modal>
        <Dialog showCloseButton title="" width={600} onClose={handleClose}>
          <Dialog.Content className="tw:p-0!">
            <div
              className="tw:flex tw:flex-col tw:max-h-[80vh]"
              ref={modalContainerRef}>
              <ConfigProvider
                getPopupContainer={() =>
                  modalContainerRef.current ?? document.body
                }>
                {/* Sticky header */}
                <div className="tw:flex tw:items-center tw:gap-3 tw:pt-5 tw:pb-4 tw:shrink-0 tw:px-6">
                  <div className="tw:flex tw:items-center tw:justify-center tw:w-10 tw:h-10 tw:rounded-lg tw:bg-blue-50 tw:border tw:border-indigo-100 tw:shrink-0">
                    <Lightbulb03
                      className="tw:text-brand-700"
                      size={20}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div className="tw:flex tw:flex-col tw:gap-0.5 tw:flex-1">
                    <div className="tw:max-w-112">
                      <Typography ellipsis size="text-lg" weight="semibold">
                        {modalTitle}
                      </Typography>
                    </div>
                    {memoryToEdit?.updatedBy && (
                      <div className="tw:flex tw:items-center tw:gap-1">
                        <Typography className="tw:text-gray-500" size="text-xs">
                          {t('label.created-by')}
                        </Typography>
                        <UserPopOverCard
                          showUserName
                          className="tw:text-gray-900"
                          profileWidth={16}
                          userName={memoryToEdit.updatedBy}
                        />
                        <span className="tw:text-gray-400 tw:leading-none tw:select-none tw:text-xl">
                          &middot;
                        </span>
                        <Typography className="tw:text-gray-500" size="text-xs">
                          {formatDate(memoryToEdit.updatedAt)}
                        </Typography>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scrollable body */}
                <div className="tw:flex tw:flex-col tw:gap-5 tw:pb-4 tw:overflow-y-auto tw:flex-1 tw:px-6">
                  {/* Section 1: Title */}
                  <div className="tw:flex tw:flex-col tw:gap-1">
                    <Input
                      data-testid="memory-title-input"
                      isDisabled={viewOnly}
                      label={t('label.title')}
                      placeholder={t('label.enter-entity', {
                        entity: t('label.title'),
                      })}
                      value={title}
                      onChange={(value) => setTitle(value)}
                    />
                  </div>

                  {/* Section 2: Memory */}
                  <div className="tw:flex tw:flex-col tw:gap-1">
                    <div className="tw:flex tw:items-center tw:justify-between">
                      <Typography
                        className="tw:text-gray-700"
                        size="text-sm"
                        weight="medium">
                        {t('label.memory')}
                        {!viewOnly && (
                          <span className="tw:text-error-primary tw:ml-0.5">
                            *
                          </span>
                        )}
                      </Typography>
                      {!viewOnly && (
                        <Typography className="tw:text-gray-400" size="text-xs">
                          {t('message.what-should-ask-collate-remember')}
                        </Typography>
                      )}
                    </div>
                    <TextArea
                      data-testid="memory-content-input"
                      isDisabled={viewOnly}
                      placeholder={t(
                        'message.what-should-ask-collate-remember'
                      )}
                      rows={5}
                      value={memory}
                      onChange={(value) => setMemory(value)}
                    />
                  </div>

                  {/* Section 3: Type */}
                  <div className="tw:flex tw:flex-col tw:gap-1">
                    <Select
                      data-testid="memory-type-select"
                      isDisabled={viewOnly}
                      label={t('label.type')}
                      placeholder={t('label.select-field', {
                        field: t('label.type'),
                      })}
                      value={memoryType || undefined}
                      onChange={(key) =>
                        setMemoryType((key as MemoryType) || '')
                      }>
                      {MEMORY_TYPE_OPTIONS.map((opt) => (
                        <Select.Item
                          id={opt.id}
                          key={opt.id}
                          label={t(opt.labelKey)}
                        />
                      ))}
                    </Select>
                  </div>

                  {/* Section 4: Linked Data Assets */}
                  <div className="tw:flex tw:flex-col tw:gap-2">
                    <Typography
                      className="tw:text-gray-600"
                      size="text-xs"
                      weight="semibold">
                      {`${t('label.linked-data-asset-plural')} (${
                        linkedAssets.length
                      })`}
                    </Typography>

                    {viewOnly ? (
                      <LinkedAssetsReadOnly assets={linkedAssets} />
                    ) : (
                      <>
                        {linkedAssets.length === 0 ? (
                          <EmptyLinkedAssets />
                        ) : (
                          <div className="tw:flex tw:flex-col tw:gap-2">
                            {linkedAssets.map((asset) => {
                              const assetKey =
                                asset.reference?.fullyQualifiedName ??
                                String(asset.value ?? '');

                              return (
                                <LinkedAssetCard
                                  asset={asset}
                                  key={assetKey}
                                  onRemove={(fqn) =>
                                    setLinkedAssets((prev) =>
                                      prev.filter(
                                        (a) =>
                                          (a.reference?.fullyQualifiedName ??
                                            String(a.value ?? '')) !== fqn
                                      )
                                    )
                                  }
                                />
                              );
                            })}
                          </div>
                        )}
                        <DataAssetSelectList
                          searchIndex={SearchIndex.DATA_ASSET}
                          value={linkedAssets}
                          onChange={handleAssetChange}
                        />
                      </>
                    )}
                  </div>

                  {/* Section 5: Metadata */}
                  <div>
                    <Typography
                      className="tw:text-gray-600"
                      size="text-xs"
                      weight="semibold">
                      {t('label.metadata')}
                    </Typography>
                    <Card className="tw:flex tw:flex-col tw:divide-y tw:divide-gray-100 tw:mt-2">
                      <div className="tw:flex tw:items-center tw:gap-3 tw:px-4 tw:py-3">
                        <div className="tw:basis-[30%]">
                          <Typography
                            className="tw:text-gray-500 tw:w-28 tw:shrink-0"
                            size="text-sm">
                            {t('label.visibility')}
                          </Typography>
                        </div>
                        <div className="tw:flex tw:items-center tw:gap-1.5">
                          <Badge
                            className="tw:flex tw:items-center tw:gap-1 tw:uppercase"
                            color="brand"
                            size="sm"
                            type="color">
                            <Share07 size={12} strokeWidth={2} />
                            {t('label.shared')}
                          </Badge>
                          <Typography
                            className="tw:text-gray-500"
                            size="text-xs">
                            {t('message.visible-to-everyone-in-workspace')}
                          </Typography>
                        </div>
                      </div>

                      {/* Tags row */}
                      <div className="tw:flex tw:flex-col tw:gap-2 tw:px-4 tw:py-3">
                        <div className="tw:flex tw:items-center tw:gap-3">
                          <div className="tw:basis-[30%]">
                            <Typography
                              className="tw:text-gray-500 tw:w-28 tw:shrink-0"
                              size="text-sm">
                              {t('label.tag-plural')}
                            </Typography>
                          </div>
                          <div className="tw:flex tw:items-center tw:gap-1.5 tw:flex-wrap tw:flex-1">
                            {selectedTags.map((tag) =>
                              viewOnly ? (
                                <Badge
                                  className="tw:max-w-40 tw:min-w-0"
                                  key={String(tag.tagFQN ?? '')}
                                  size="sm"
                                  type="modern">
                                  {tag.style?.color && (
                                    <div className="tw:shrink-0">
                                      <Dot
                                        size="sm"
                                        style={{
                                          color: tag.style?.color,
                                          marginRight: '6px',
                                        }}
                                      />
                                    </div>
                                  )}
                                  <Typography
                                    ellipsis
                                    className="tw:text-gray-700"
                                    size="text-xs">
                                    {tag.tagFQN}
                                  </Typography>
                                </Badge>
                              ) : (
                                <BadgeWithButton
                                  color="gray"
                                  key={tag.tagFQN}
                                  type="modern"
                                  onButtonClick={() =>
                                    handleRemoveTag(tag.tagFQN)
                                  }>
                                  <div className="tw:max-w-40 tw:flex tw:items-center">
                                    {tag.style?.color && (
                                      <div className="tw:shrink-0">
                                        <Dot
                                          size="sm"
                                          style={{
                                            color: tag.style?.color,
                                            marginRight: '6px',
                                          }}
                                        />
                                      </div>
                                    )}
                                    <Typography
                                      ellipsis
                                      className="tw:text-gray-700"
                                      size="text-xs">
                                      {tag.tagFQN}
                                    </Typography>
                                  </div>
                                </BadgeWithButton>
                              )
                            )}
                            {!viewOnly && (
                              <Button
                                color="link-color"
                                iconLeading={Plus}
                                size="sm"
                                onClick={() => setShowTagForm((v) => !v)}>
                                {t('label.add-entity', {
                                  entity: t('label.tag'),
                                })}
                              </Button>
                            )}
                          </div>
                        </div>

                        {showTagForm && !viewOnly && (
                          <TagSelectForm
                            defaultValue={selectedTags.map((tag) => tag.tagFQN)}
                            fetchApi={fetchTagOptions}
                            placeholder={t('label.search-entity', {
                              entity: t('label.tag-plural'),
                            })}
                            tagType={TagSource.Classification}
                            onCancel={() => setShowTagForm(false)}
                            onSubmit={handleTagSave}
                          />
                        )}
                      </div>

                      {Boolean(memoryToEdit?.updatedAt) && (
                        <div className="tw:flex tw:items-center tw:gap-3 tw:px-4 tw:py-3">
                          <div className="tw:basis-[30%]">
                            <Typography
                              className="tw:text-gray-500 tw:w-28 tw:shrink-0"
                              size="text-sm">
                              {t('label.updated')}
                            </Typography>
                          </div>
                          <Typography
                            className="tw:text-gray-600"
                            size="text-sm">
                            {formatDate(memoryToEdit?.updatedAt)}
                          </Typography>
                        </div>
                      )}
                      {memoryToEdit?.usageCount !== undefined && (
                        <div className="tw:flex tw:items-center tw:gap-3 tw:px-4 tw:py-3">
                          <div className="tw:basis-[30%]">
                            <Typography
                              className="tw:text-gray-500 tw:w-28 tw:shrink-0"
                              size="text-sm">
                              {t('label.used-by-ask-collate')}
                            </Typography>
                          </div>
                          <Typography
                            className="tw:text-gray-600"
                            size="text-sm">
                            {t('label.used-n-times', {
                              count: memoryToEdit.usageCount,
                            })}
                          </Typography>
                        </div>
                      )}
                    </Card>
                  </div>
                </div>

                {/* Sticky footer */}
                {!viewOnly && (
                  <div className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:py-4 tw:border-t tw:border-gray-100 tw:shrink-0 tw:px-6">
                    <div>
                      {isEditMode && (
                        <Button
                          color="tertiary-destructive"
                          iconLeading={Trash01}
                          isDisabled={isDeleting || isSubmitting}
                          isLoading={isDeleting}
                          size="sm"
                          onClick={handleDelete}>
                          {t('label.delete')}
                        </Button>
                      )}
                    </div>
                    <div className="tw:flex tw:items-center tw:gap-3">
                      <Button
                        color="secondary"
                        isDisabled={isSubmitting || isDeleting}
                        size="sm"
                        onClick={handleClose}>
                        {t('label.cancel')}
                      </Button>
                      <Button
                        color="primary"
                        isDisabled={
                          isSubmitDisabled || isSubmitting || isDeleting
                        }
                        isLoading={isSubmitting}
                        size="sm"
                        onClick={handleSubmit}>
                        {submitLabel}
                      </Button>
                    </div>
                  </div>
                )}
              </ConfigProvider>
            </div>
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default CreateMemoryModal;
