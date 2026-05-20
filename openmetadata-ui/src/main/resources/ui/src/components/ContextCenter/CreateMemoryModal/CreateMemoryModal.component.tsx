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
  BadgeWithDot,
  Button,
  Card,
  Dialog,
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
import UserPopOverCard from 'components/common/PopOverCard/UserPopOverCard';
import { compare } from 'fast-json-patch';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DataAssetAsyncSelectList from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import TagSelectForm from '../../../components/Tag/TagsSelectForm/TagsSelectForm.component';
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
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import tagClassBase from '../../../utils/TagClassBase';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { CreateMemoryModalProps } from './CreateMemoryModal.interface';

const MEMORY_TYPE_OPTIONS = [
  { id: MemoryType.FAQ, label: 'FAQ' },
  { id: MemoryType.Note, label: 'Note' },
  { id: MemoryType.Preference, label: 'Preference' },
  { id: MemoryType.Runbook, label: 'Runbook' },
  { id: MemoryType.UseCase, label: 'Use Case' },
];

const SectionDivider: FC<{ label: string }> = ({ label }) => (
  <div className="tw:flex tw:items-center tw:gap-3 tw:my-2">
    <Typography
      className="tw:text-gray-500 tw:whitespace-nowrap"
      size="text-xs"
      weight="medium">
      {label}
    </Typography>
    <div className="tw:flex-1 tw:h-px tw:bg-gray-200" />
  </div>
);

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
  const isEditMode = Boolean(memoryToEdit) && !viewOnly;
  const containerRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState('');
  const [memory, setMemory] = useState('');
  const [memoryType, setMemoryType] = useState<MemoryType | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [linkedAssets, setLinkedAssets] = useState<DataAssetOption[]>([]);
  const [showAssetPicker, setShowAssetPicker] = useState(false);

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
        reference: ref as DataAssetOption['reference'],
      }));
      setLinkedAssets(assetOptions);
    } else {
      setTitle('');
      setMemory('');
      setMemoryType('');
      setSelectedTags([]);
      setLinkedAssets([]);
    }
    setShowAssetPicker(false);
    setShowTagForm(false);
  }, [memoryToEdit]);

  const handleClose = () => {
    setTitle('');
    setMemory('');
    setMemoryType('');
    setLinkedAssets([]);
    setSelectedTags([]);
    setShowAssetPicker(false);
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

  const handleRemoveAsset = useCallback((fqn: string) => {
    setLinkedAssets((prev) =>
      prev.filter((a) => a.reference?.fullyQualifiedName !== fqn)
    );
  }, []);

  const handleTagSave = useCallback(
    async (tags: DefaultOptionType | DefaultOptionType[]) => {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      const newTags: TagLabel[] = tagArray.map((tag) => ({
        tagFQN: typeof tag === 'string' ? tag : String(tag.value ?? ''),
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
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
        const original = {
          title: memoryToEdit.title ?? '',
          summary: memoryToEdit.summary ?? '',
          answer: memoryToEdit.answer,
          question: memoryToEdit.question,
          memoryType: memoryToEdit.memoryType,
          tags: memoryToEdit.tags ?? [],
        };
        const updated = {
          title: title.trim(),
          summary: '',
          answer: memory.trim(),
          question: memory.trim(),
          memoryType: memoryType || undefined,
          tags: selectedTags,
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

  const hasSourceConversation =
    Boolean(memoryToEdit?.question) &&
    memoryToEdit?.question !== memoryToEdit?.answer;

  return (
    <ModalOverlay
      isDismissable
      isOpen={isOpen}
      style={{ zIndex: 999 }}
      onOpenChange={(open) => !open && handleClose()}>
      <Modal>
        <Dialog showCloseButton title="" width={560} onClose={handleClose}>
          <Dialog.Content className="tw:p-0">
            <div
              className="tw:flex tw:flex-col tw:max-h-[80vh]"
              ref={containerRef}>
              <ConfigProvider
                getPopupContainer={() => containerRef.current ?? document.body}>
                {/* Sticky header */}
                <div className="tw:flex tw:items-center tw:gap-3 tw:p-6 tw:pb-4 tw:shrink-0">
                  <div className="tw:flex tw:items-center tw:justify-center tw:w-10 tw:h-10 tw:rounded-lg tw:bg-blue-50 tw:shrink-0">
                    <Lightbulb03
                      size={20}
                      strokeWidth={1.5}
                      style={{ color: 'var(--color-primary)' }}
                    />
                  </div>
                  <div className="tw:flex tw:flex-col tw:gap-0.5 tw:flex-1">
                    <Typography size="text-lg" weight="semibold">
                      {isEditMode
                        ? t('label.edit-entity', {
                            entity: t('label.memory'),
                          })
                        : viewOnly
                        ? t('label.details')
                        : t('label.add-entity', {
                            entity: t('label.memory'),
                          })}
                    </Typography>
                    {memoryToEdit?.updatedBy && (
                      <div className="tw:flex tw:items-center tw:gap-1">
                        <Typography className="tw:text-gray-500" size="text-xs">
                          {t('label.created-by')}
                        </Typography>
                        <UserPopOverCard
                          showUserName
                          profileWidth={16}
                          userName={memoryToEdit.updatedBy}
                        />
                        <span className="tw:text-gray-400 tw:leading-none tw:select-none tw:text-xl">
                          &middot;
                        </span>
                        <Typography className="tw:text-gray-500" size="text-xs">
                          {formatDateTime(memoryToEdit.updatedAt)}
                        </Typography>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scrollable body */}
                <div className="tw:flex tw:flex-col tw:gap-4 tw:px-6 tw:pb-4 tw:overflow-y-auto tw:flex-1">
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
                          label={opt.label}
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
                      {t('label.linked-data-asset-plural')}
                    </Typography>

                    {linkedAssets.length > 0 && (
                      <div className="tw:flex tw:flex-col tw:gap-1">
                        {linkedAssets.map((asset) => (
                          <div
                            className="tw:flex tw:items-center tw:gap-3 tw:px-3 tw:py-2 tw:rounded-lg tw:bg-gray-50 tw:border tw:border-gray-100"
                            key={
                              asset.reference?.fullyQualifiedName ?? asset.value
                            }>
                            <div className="tw:flex tw:items-center tw:justify-center tw:w-8 tw:h-8 tw:rounded-md tw:bg-blue-50 tw:shrink-0">
                              {searchClassBase.getEntityIcon(
                                asset.reference?.type ?? ''
                              )}
                            </div>
                            <div className="tw:flex tw:flex-col tw:min-w-0 tw:flex-1">
                              <div className="tw:flex tw:items-center tw:gap-1.5">
                                <Typography
                                  className="tw:truncate"
                                  size="text-sm"
                                  weight="medium">
                                  {asset.displayName ||
                                    (typeof asset.label === 'string'
                                      ? asset.label
                                      : '')}
                                </Typography>
                                {asset.reference?.type && (
                                  <span className="tw:px-1.5 tw:py-0.5 tw:rounded tw:bg-gray-200 tw:text-gray-600 tw:text-xs tw:whitespace-nowrap tw:shrink-0">
                                    {asset.reference.type}
                                  </span>
                                )}
                              </div>
                              <Typography
                                className="tw:text-gray-400 tw:truncate"
                                size="text-xs">
                                {asset.reference?.fullyQualifiedName ?? ''}
                              </Typography>
                            </div>
                            {!viewOnly && (
                              <button
                                className="tw:shrink-0 tw:text-gray-400 tw:hover:text-gray-600"
                                onClick={() =>
                                  handleRemoveAsset(
                                    asset.reference?.fullyQualifiedName ?? ''
                                  )
                                }>
                                <X size={14} strokeWidth={2} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {linkedAssets.length === 0 && !showAssetPicker && (
                      <div className="tw:flex tw:items-center tw:justify-center tw:border tw:border-dashed tw:border-gray-300 tw:rounded-lg tw:py-4 tw:px-3">
                        <Typography className="tw:text-gray-400" size="text-sm">
                          {t('label.not-linked-to-any-data-asset')}
                        </Typography>
                      </div>
                    )}

                    {showAssetPicker && !viewOnly && (
                      <DataAssetAsyncSelectList
                        autoFocus
                        dropdownStyle={{ minWidth: 480 }}
                        mode="multiple"
                        placeholder={t('label.search-entity', {
                          entity: t('label.asset-plural'),
                        })}
                        searchIndex={SearchIndex.DATA_ASSET}
                        value={linkedAssets}
                        onChange={handleAssetChange}
                      />
                    )}

                    {!viewOnly && (
                      <div>
                        <Button
                          color="secondary"
                          iconLeading={Plus}
                          size="sm"
                          onClick={() => setShowAssetPicker((v) => !v)}>
                          {t('label.link-entity', { entity: t('label.asset') })}
                        </Button>
                      </div>
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
                    <Card className="tw:flex tw:flex-col tw:divide-y tw:divide-gray-100 tw:overflow-hidden tw:mt-2">
                      <div className="tw:flex tw:items-center tw:gap-3 tw:px-4 tw:py-3">
                        <Typography
                          className="tw:text-gray-500 tw:w-28 tw:shrink-0"
                          size="text-sm">
                          {t('label.visibility')}
                        </Typography>
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
                          <Typography
                            className="tw:text-gray-500 tw:w-28 tw:shrink-0"
                            size="text-sm">
                            {t('label.tag-plural')}
                          </Typography>
                          <div className="tw:flex tw:items-center tw:gap-1.5 tw:flex-wrap tw:flex-1">
                            {selectedTags.map((tag) =>
                              viewOnly ? (
                                <BadgeWithDot
                                  color="gray"
                                  key={tag.tagFQN}
                                  type="color">
                                  {tag.tagFQN}
                                </BadgeWithDot>
                              ) : (
                                <BadgeWithButton
                                  color="gray"
                                  key={tag.tagFQN}
                                  type="color"
                                  onButtonClick={() =>
                                    handleRemoveTag(tag.tagFQN)
                                  }>
                                  {tag.tagFQN}
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
                          <Typography
                            className="tw:text-gray-500 tw:w-28 tw:shrink-0"
                            size="text-sm">
                            {t('label.updated')}
                          </Typography>
                          <Typography
                            className="tw:text-gray-600"
                            size="text-sm">
                            {formatDateTime(memoryToEdit?.updatedAt)}
                          </Typography>
                        </div>
                      )}
                      {memoryToEdit?.usageCount !== undefined && (
                        <div className="tw:flex tw:items-center tw:gap-3 tw:px-4 tw:py-3">
                          <Typography
                            className="tw:text-gray-500 tw:w-28 tw:shrink-0"
                            size="text-sm">
                            {t('label.used-by-ask-collate')}
                          </Typography>
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

                  {/* Section 6: Source Conversation */}
                  {hasSourceConversation && (
                    <>
                      <SectionDivider label={t('label.source-conversation')} />
                      <div className="tw:flex tw:flex-col tw:gap-2">
                        {/* User question bubble */}
                        <div className="tw:flex tw:justify-end">
                          <div className="tw:max-w-[85%] tw:px-3 tw:py-2 tw:rounded-2xl tw:rounded-br-sm tw:bg-brand-50 tw:border tw:border-brand-100">
                            <Typography
                              className="tw:text-gray-800 tw:whitespace-pre-wrap"
                              size="text-xs">
                              {memoryToEdit?.question}
                            </Typography>
                          </div>
                        </div>
                        {/* Assistant answer bubble */}
                        <div className="tw:flex tw:justify-start">
                          <div className="tw:max-w-[85%] tw:px-3 tw:py-2 tw:rounded-2xl tw:rounded-bl-sm tw:bg-gray-50 tw:border tw:border-gray-100">
                            <Typography
                              className="tw:text-gray-700 tw:whitespace-pre-wrap"
                              size="text-xs">
                              {memoryToEdit?.answer}
                            </Typography>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Sticky footer */}
                {!viewOnly && (
                  <div className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:px-6 tw:py-4 tw:border-t tw:border-gray-100 tw:shrink-0">
                    <div>
                      {isEditMode && (
                        <Button
                          color="primary-destructive"
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
                        {isEditMode
                          ? t('label.save-entity', {
                              entity: t('label.change-plural'),
                            })
                          : t('label.create-entity', {
                              entity: t('label.memory'),
                            })}
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
