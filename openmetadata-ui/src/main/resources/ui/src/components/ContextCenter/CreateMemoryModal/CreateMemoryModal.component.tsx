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
  Card,
  Dialog,
  FieldProp,
  FieldTypes,
  FormField,
  FormItemLabel,
  FormSelectItem,
  getField,
  HintText,
  HookForm,
  Modal,
  ModalOverlay,
  Select,
  TextArea,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Database01,
  FileLock02,
  InfoCircle,
  Lightbulb03,
  Lock01,
  Plus,
  Share07,
  Trash01,
  X,
} from '@untitledui/icons';
import { ConfigProvider } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { debounce } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import {
  getCustomMarkdownComponents,
  preprocessMarkdownText,
} from '../../../components/common/MarkdownEditor/markdownComponents';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import { DataAssetOption } from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import { ROUTES } from '../../../constants/constants';
import {
  MEMORY_TYPE_OPTIONS,
  VISIBILITY_OPTIONS,
} from '../../../constants/ContextCenter.constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import {
  EntityReference,
  LabelType,
  MemoryType,
  ShareVisibility,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/entity/context/contextMemory';
import {
  createContextMemory,
  deleteContextMemory,
  updateContextMemory,
} from '../../../rest/contextMemoryAPI';
import { getEntityIconWithBg } from '../../../utils/Assets/AssetsUtils';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { formatDate } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getErrorText } from '../../../utils/StringUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { showSuccessToast } from '../../../utils/ToastUtils';
import DataAssetSelectList from '../../DataAssets/DataAssetSelectList/DataAssetSelectList';
import DerivedOntologyCard from '../DerivedOntologyCard/DerivedOntologyCard.component';
import {
  CreateMemoryModalProps,
  MemoryFormValues,
} from './CreateMemoryModal.interface';

// ─── Form types ───────────────────────────────────────────────────────────────

const DEFAULT_FORM_VALUES: MemoryFormValues = {
  title: '',
  memory: '',
  memoryType: null,
  visibility: ShareVisibility.Shared,
  tags: [],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const LinkedAssetCard: FC<{
  asset: DataAssetOption;
  onRemove?: (fqn: string) => void;
}> = ({ asset, onRemove }) => {
  const displayName =
    asset.displayName || (typeof asset.label === 'string' ? asset.label : '');

  const fqn = asset.reference?.fullyQualifiedName ?? String(asset.value ?? '');

  return (
    <Card
      className="tw:flex tw:items-center tw:gap-2.5 tw:px-3 tw:py-2.5"
      data-testid="linked-asset-card">
      <div className="tw:shrink-0">
        {getEntityIconWithBg(
          asset.reference?.type,
          { className: 'tw:w-8 tw:h-8' },
          { size: 18 }
        )}
      </div>
      <Box
        align="center"
        className="tw:flex-1 tw:min-w-0 tw:gap-2.5"
        justify="between">
        <div className="tw:min-w-0 tw:flex-1 tw:pr-2 tw:[&_.prose]:leading-tight">
          <Typography
            ellipsis
            className="tw:leading-tight"
            size="text-xs"
            weight="medium">
            {displayName}
          </Typography>
          <Typography
            ellipsis
            className="tw:text-utility-gray-700 tw:leading-tight"
            size="text-xs">
            {asset.reference?.fullyQualifiedName ?? ''}
          </Typography>
        </div>
        <div className="tw:flex tw:items-center tw:gap-2.5 tw:shrink-0">
          {asset.reference?.type && (
            <Badge
              className="tw:capitalize"
              color="gray"
              size="sm"
              type="modern">
              {asset.reference.type}
            </Badge>
          )}
          {onRemove && (
            <ButtonUtility
              color="tertiary"
              data-testid="remove-linked-asset-btn"
              icon={<X size={18} strokeWidth={2} />}
              onClick={() => onRemove(fqn)}
            />
          )}
        </div>
      </Box>
    </Card>
  );
};

const EmptyLinkedAssets: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="tw:p-3 tw:border-dashed tw:border tw:rounded-lg tw:border-primary tw:flex tw:justify-center tw:items-center">
      <Typography className="tw:text-utility-gray-400" size="text-sm">
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

const VISIBILITY_ICON_MAP = {
  Share07: <Share07 size={12} strokeWidth={2} />,
  Database01: <Database01 size={12} strokeWidth={2} />,
  FileLock02: <FileLock02 size={12} strokeWidth={2} />,
};

const tagLabelToOption = (tag: TagLabel): FormSelectItem => ({
  id: tag.tagFQN,
  label: tag.displayName || tag.name || tag.tagFQN,
  supportingText: tag.displayName ? tag.name : undefined,
});

// ─── Main component ───────────────────────────────────────────────────────────

const CreateMemoryModal: FC<CreateMemoryModalProps> = ({
  memoryToEdit,
  isOpen,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
  isAdminUser,
  canCreate = false,
  canEdit = false,
  viewOnly = false,
  canDelete = false,
  currentUserName,
}) => {
  const { t } = useTranslation();
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const [isViewOnly, setIsViewOnly] = useState(viewOnly);
  const isEditMode = Boolean(memoryToEdit) && !isViewOnly;

  let modalTitle = t('label.add-entity', { entity: t('label.memory') });
  if (isEditMode) {
    modalTitle = t('label.edit-entity', { entity: t('label.memory') });
  } else if (isViewOnly) {
    modalTitle =
      memoryToEdit?.title ||
      t('label.edit-entity', { entity: t('label.memory') });
  }

  const submitLabel = isEditMode
    ? t('label.save-entity', { entity: t('label.change-plural') })
    : t('label.create-entity', { entity: t('label.memory') });

  // ── RHF form state ──────────────────────────────────────────────────────────
  const form = useForm<MemoryFormValues>({
    defaultValues: DEFAULT_FORM_VALUES,
  });
  const {
    formState: { isSubmitting },
  } = form;

  // Watch memory value to derive the submit-disabled state
  const watchedMemory = form.watch('memory');

  // ── Remaining UI state (not form values) ────────────────────────────────────
  const [memoryTab, setMemoryTab] = useState<'edit' | 'preview'>('edit');
  const [isEditingVisibility, setIsEditingVisibility] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalError, setModalError] = useState<string>('');
  const [linkedAssets, setLinkedAssets] = useState<DataAssetOption[]>([]);
  const tagDataMap = useRef<Map<string, TagLabel>>(new Map());

  const isOwner = useMemo(
    () =>
      memoryToEdit?.owners?.some((owner) => owner.name === currentUserName) ??
      false,
    [memoryToEdit, currentUserName]
  );

  const memorySource = memoryToEdit?.sourceEntity ?? memoryToEdit?.sourceFile;

  const memorySourceLink = useMemo(() => {
    if (!memorySource) {
      return undefined;
    }

    return memorySource.type === EntityType.KNOWLEDGE_PAGE
      ? contextCenterClassBase.getArticlePath(
          memorySource.fullyQualifiedName ?? ''
        )
      : `${ROUTES.CONTEXT_CENTER_DOCUMENTS}?document=${memorySource.id}`;
  }, [memorySource]);

  const { showEditButton, showSubmitButton } = useMemo(() => {
    const canEditMemory = (isOwner || isAdminUser) && canEdit;
    const showEditButton = isViewOnly && canEditMemory;
    const showSubmitButton =
      !isViewOnly && (memoryToEdit ? canEditMemory : canCreate);

    return { showEditButton, showSubmitButton };
  }, [isViewOnly, isOwner, isAdminUser, canEdit, canCreate, memoryToEdit]);

  useEffect(() => {
    setIsViewOnly(viewOnly);
  }, [viewOnly]);

  // Populate / reset form whenever the memory being edited changes
  useEffect(() => {
    if (memoryToEdit) {
      const memoryTypeOption = memoryToEdit.memoryType
        ? MEMORY_TYPE_OPTIONS.find((opt) => opt.id === memoryToEdit.memoryType)
        : undefined;

      form.reset({
        title: memoryToEdit.title ?? '',
        memory: memoryToEdit.answer ?? memoryToEdit.question ?? '',
        memoryType: memoryTypeOption
          ? { id: memoryTypeOption.id, label: t(memoryTypeOption.labelKey) }
          : null,
        visibility:
          memoryToEdit.shareConfig?.visibility ?? ShareVisibility.Shared,
        tags: (memoryToEdit.tags ?? []).map(tagLabelToOption),
      });

      (memoryToEdit.tags ?? []).forEach((tag) =>
        tagDataMap.current.set(tag.tagFQN, tag)
      );

      const toAssetOption = (ref: EntityReference): DataAssetOption => ({
        label: ref.displayName ?? ref.name ?? '',
        value: ref.fullyQualifiedName ?? ref.id,
        displayName: ref.displayName ?? ref.name ?? '',
        reference: ref,
      });
      const assetOptions: DataAssetOption[] = [
        ...(memoryToEdit.primaryEntity
          ? [toAssetOption(memoryToEdit.primaryEntity)]
          : []),
        ...(memoryToEdit.relatedEntities ?? []).map(toAssetOption),
      ];
      setLinkedAssets(assetOptions);
    } else {
      form.reset(DEFAULT_FORM_VALUES);
      setLinkedAssets([]);
    }
    setModalError('');
    setIsEditingVisibility(false);
  }, [memoryToEdit]);

  const handleClose = () => {
    form.reset(DEFAULT_FORM_VALUES);
    setLinkedAssets([]);
    setModalError('');
    setIsEditingVisibility(false);
    setIsViewOnly(viewOnly);
    onClose();
  };

  const isSubmitDisabled = !watchedMemory?.trim();

  const handleAssetChange = useCallback(
    (option?: DataAssetOption | DataAssetOption[]) => {
      if (!option) {
        setLinkedAssets([]);

        return;
      }
      const options = Array.isArray(option) ? option : [option];
      setLinkedAssets(options);
    },
    []
  );

  const [tagOptions, setTagOptions] = useState<FormSelectItem[]>([]);

  const fetchTagOptions = useCallback(async (searchText = '') => {
    try {
      const response = await tagClassBase.getTags(searchText, 1, true);
      const fetched = (response?.data ?? []).filter((opt) => opt.value);

      fetched.forEach((opt) => {
        const tagData = opt.data as Tag | undefined;
        tagDataMap.current.set(opt.value, {
          tagFQN: opt.value,
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
          name: tagData?.name,
          displayName: tagData?.displayName,
          style: tagData?.style,
        });
      });

      setTagOptions(
        fetched.map((opt) => ({
          id: opt.value,
          label: opt.label,
          supportingText: (opt.data as Tag | undefined)?.displayName,
        }))
      );
    } catch {
      setTagOptions([]);
    }
  }, []);

  const debouncedTagSearch = useMemo(
    () =>
      debounce((searchText: string) => void fetchTagOptions(searchText), 250),
    [fetchTagOptions]
  );

  useEffect(() => () => debouncedTagSearch.cancel(), [debouncedTagSearch]);

  const handleSubmit = async (values: MemoryFormValues) => {
    setModalError('');
    try {
      const { title, memory, memoryType, visibility, tags } = values;
      const memoryTypeValue = (memoryType?.id as MemoryType) || undefined;
      const selectedTags: TagLabel[] = tags.map(
        (option) =>
          tagDataMap.current.get(option.id) ?? {
            tagFQN: option.id,
            source: TagSource.Classification,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          }
      );

      const validAssets = linkedAssets.filter(
        (a) => a.reference?.id && a.reference?.type
      );
      const toRef = (a: DataAssetOption): EntityReference => ({
        id: a.reference!.id,
        type: a.reference!.type,
        name: a.reference?.name,
        displayName: a.reference?.displayName,
        fullyQualifiedName: a.reference?.fullyQualifiedName,
      });
      const primaryEntity = validAssets[0] ? toRef(validAssets[0]) : undefined;
      const relatedEntities = validAssets.slice(1).map(toRef);

      if (isEditMode && memoryToEdit) {
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
          t('server.entity-updated-success', { entity: t('label.memory') })
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
          ...(memoryTypeValue ? { memoryType: memoryTypeValue } : {}),
          ...(selectedTags.length > 0 ? { tags: selectedTags } : {}),
          ...(primaryEntity ? { primaryEntity } : {}),
          ...(relatedEntities.length > 0 ? { relatedEntities } : {}),
          shareConfig: { visibility },
        });

        showSuccessToast(
          t('server.create-entity-success', { entity: t('label.memory') })
        );
        onCreated();
      }
      handleClose();
    } catch (err) {
      setModalError(
        getErrorText(err as AxiosError, t('server.unexpected-error'))
      );
    }
  };

  const handleDelete = async () => {
    if (!memoryToEdit) {
      return;
    }
    setIsDeleting(true);
    setModalError('');
    try {
      await deleteContextMemory(memoryToEdit.id);
      showSuccessToast(
        t('server.entity-deleted-successfully', { entity: t('label.memory') })
      );
      onDeleted?.();
      handleClose();
    } catch (err) {
      setModalError(
        getErrorText(err as AxiosError, t('server.unexpected-error'))
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSwitchToEdit = () => {
    setIsViewOnly(false);
  };

  // ── FieldProp definitions ────────────────────────────────────────────────────

  const titleField: FieldProp = {
    name: 'title',
    label: t('label.title'),
    type: FieldTypes.TEXT,
    props: {
      'data-testid': 'memory-title-input',
      disabled: isViewOnly,
      placeholder: t('label.enter-entity', { entity: t('label.title') }),
    },
  };

  const memoryTypeField: FieldProp = {
    name: 'memoryType',
    label: t('label.type'),
    type: FieldTypes.SELECT,
    props: {
      'data-testid': 'memory-type-select',
      disabled: isViewOnly,
      placeholder: t('label.select-field', { field: t('label.type') }),
      options: MEMORY_TYPE_OPTIONS.map((opt) => ({
        id: opt.id,
        label: t(opt.labelKey),
      })),
    },
  };

  const tagsField: FieldProp = {
    name: 'tags',
    label: t('label.tag-plural'),
    placeholder: t('label.select-field', { field: t('label.tag-plural') }),
    type: FieldTypes.TAG_SUGGESTION,
    props: {
      'data-testid': 'memory-tags-select',
      disabled: isViewOnly,
      multiple: true,
      onFocus: () => void fetchTagOptions(),
      onSearchChange: (searchText: string) => debouncedTagSearch(searchText),
      options: tagOptions,
    },
  };

  // ── Memory content renderer (used inside FormField escape hatch) ─────────────

  const renderMemoryContent = (field: {
    value: string;
    onChange: (v: string) => void;
  }) => {
    if (isViewOnly) {
      return (
        <div
          className="prose tw:p-3 tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:h-36 tw:overflow-y-auto tw:resize-y"
          data-testid="description-field-preview">
          <ReactMarkdown components={getCustomMarkdownComponents()}>
            {preprocessMarkdownText(field.value)}
          </ReactMarkdown>
        </div>
      );
    }
    if (memoryTab === 'edit') {
      return (
        <TextArea
          data-testid="memory-content-input"
          placeholder={t('message.what-should-ask-collate-remember')}
          rows={5}
          value={field.value}
          onChange={(value) => field.onChange(value)}
        />
      );
    }

    return (
      <div className="prose tw:p-3 tw:rounded-lg tw:border tw:border-secondary tw:bg-tertiary tw:text-secondary tw:h-36 tw:overflow-y-auto tw:resize-y">
        {field.value.trim() ? (
          <ReactMarkdown components={getCustomMarkdownComponents()}>
            {preprocessMarkdownText(field.value)}
          </ReactMarkdown>
        ) : (
          <Typography className="tw:text-utility-gray-400" size="text-sm">
            {t('message.nothing-to-preview')}
          </Typography>
        )}
      </div>
    );
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      style={{ zIndex: 999 }}
      onOpenChange={(open) => !open && handleClose()}>
      <Modal>
        <Dialog showCloseButton title="" width={600} onClose={handleClose}>
          <Dialog.Content className="tw:p-0!">
            <div ref={modalContainerRef}>
              <ConfigProvider
                getPopupContainer={() =>
                  modalContainerRef.current ?? document.body
                }>
                <HookForm
                  className="tw:flex tw:flex-col tw:max-h-[92vh]"
                  form={form}
                  onSubmit={form.handleSubmit(handleSubmit)}>
                  {/* Sticky header */}
                  <div className="tw:flex tw:items-center tw:gap-3 tw:pt-5 tw:pb-4 tw:shrink-0 tw:px-6">
                    <div className="tw:flex tw:items-center tw:justify-center tw:w-10 tw:h-10 tw:rounded-lg tw:bg-utility-brand-50 tw:border tw:border-utility-indigo-100 tw:shrink-0">
                      <Lightbulb03
                        className="tw:text-utility-brand-700"
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
                      {(memoryToEdit?.owners?.[0]?.name ??
                        memoryToEdit?.updatedBy) && (
                        <div className="tw:flex tw:items-center tw:gap-1">
                          <Typography
                            className="tw:text-quaternary"
                            size="text-xs">
                            {t('label.created-by')}
                          </Typography>
                          <UserPopOverCard
                            showUserName
                            className="tw:text-primary"
                            profileWidth={16}
                            userName={memoryToEdit?.owners?.[0]?.name || ''}
                          />
                          <span className="tw:text-utility-gray-400 tw:leading-none tw:select-none tw:text-xl">
                            &middot;
                          </span>
                          <Typography
                            className="tw:text-quaternary"
                            size="text-xs">
                            {formatDate(memoryToEdit.updatedAt)}
                          </Typography>
                        </div>
                      )}
                      {memorySource && memorySourceLink && (
                        <div className="tw:flex tw:items-center tw:gap-1">
                          <FileLock02
                            className="tw:shrink-0 tw:text-utility-gray-400"
                            size={12}
                            strokeWidth={2}
                          />
                          <Typography
                            className="tw:text-quaternary"
                            size="text-xs">
                            {t('label.extracted-from')}
                          </Typography>
                          <Link
                            className="tw:text-xs tw:font-medium tw:text-brand-secondary tw:hover:underline tw:truncate"
                            data-testid="memory-source-file-link"
                            to={memorySourceLink}>
                            {getEntityName(memorySource)}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scrollable body */}
                  <div className="tw:flex tw:flex-col tw:gap-5 tw:pb-4 tw:overflow-y-auto tw:flex-1 tw:px-6">
                    {/* Read-only banner for non-owners */}
                    {isViewOnly && !isOwner && !canDelete && memoryToEdit && (
                      <div className="tw:flex tw:items-start tw:gap-2 tw:rounded-lg tw:border tw:border-warning-300 tw:bg-warning-50 tw:px-3 tw:py-2.5">
                        <Lock01
                          className="tw:shrink-0 tw:text-warning-700 tw:mt-0.5"
                          size={16}
                          strokeWidth={2}
                        />
                        <div className="tw:flex tw:flex-col">
                          <Typography
                            className="tw:text-warning-700"
                            size="text-xs"
                            weight="semibold">
                            {t('label.cant-edit-this-memory')}
                          </Typography>
                          <Typography
                            as="p"
                            className="tw:text-warning-700 tw:leading-4"
                            size="text-xs">
                            {t('message.context-memory-read-only-description', {
                              creatorName:
                                memoryToEdit.owners?.[0]?.name ??
                                memoryToEdit.updatedBy,
                            })}
                          </Typography>
                        </div>
                      </div>
                    )}

                    {/* Inline error alert */}
                    {modalError && (
                      <Alert
                        closable
                        title={modalError}
                        variant="error"
                        onClose={() => setModalError('')}
                      />
                    )}

                    {/* Section 1: Title — uses getField (TEXT) */}
                    <div className="tw:flex tw:flex-col tw:gap-1">
                      {getField(titleField)}
                    </div>

                    {/* Section 2: Memory content — FormField escape hatch for custom preview/edit tabs */}
                    <FormField
                      control={form.control}
                      name="memory"
                      rules={{
                        required: t('label.field-required', {
                          field: t('label.memory'),
                        }),
                      }}>
                      {({ field, fieldState }) => (
                        <div className="tw:flex tw:flex-col tw:gap-1">
                          <div className="tw:flex tw:items-center tw:justify-between">
                            <div className="tw:flex tw:items-center tw:gap-1">
                              <FormItemLabel
                                label={t('label.memory')}
                                required={!isViewOnly}
                              />
                              <Tooltip
                                title={t(
                                  'message.what-should-ask-collate-remember'
                                )}>
                                <TooltipTrigger className="tw:leading-0">
                                  <InfoCircle
                                    className="tw:text-utility-gray-400 tw:cursor-pointer"
                                    size={14}
                                    strokeWidth={2}
                                  />
                                </TooltipTrigger>
                              </Tooltip>
                            </div>
                            {!isViewOnly && (
                              <Button
                                color="secondary"
                                size="sm"
                                onClick={() =>
                                  setMemoryTab((prev) =>
                                    prev === 'edit' ? 'preview' : 'edit'
                                  )
                                }>
                                {memoryTab === 'edit'
                                  ? t('label.preview')
                                  : t('label.edit')}
                              </Button>
                            )}
                          </div>
                          {renderMemoryContent(field)}
                          {fieldState.error?.message && (
                            <HintText isInvalid>
                              {fieldState.error.message}
                            </HintText>
                          )}
                        </div>
                      )}
                    </FormField>

                    {/* Section 3: Type — uses getField (SELECT) */}
                    <div className="tw:flex tw:flex-col tw:gap-1">
                      {getField(memoryTypeField)}
                    </div>

                    {/* Section 4: Linked Data Assets */}
                    <div className="tw:flex tw:flex-col tw:gap-2">
                      <Typography
                        className="tw:text-tertiary"
                        size="text-xs"
                        weight="semibold">
                        {`${t('label.linked-data-asset-plural')} (${
                          linkedAssets.length
                        })`}
                      </Typography>

                      {isViewOnly ? (
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
                            placeholder={t('label.search-assets-to-link')}
                            popoverClassName="tw:h-100"
                            renderTrigger={({ open }) => (
                              <Button
                                className="tw:px-2.5 tw:py-1.5"
                                color="tertiary"
                                iconLeading={Plus}
                                size="sm"
                                onPress={open}>
                                {t('label.link-an-entity', {
                                  entity: t('label.asset'),
                                })}
                              </Button>
                            )}
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
                        className="tw:text-tertiary"
                        size="text-xs"
                        weight="semibold">
                        {t('label.metadata')}
                      </Typography>
                      <Card className="tw:flex tw:flex-col tw:divide-y tw:divide-tertiary tw:mt-2">
                        {/* Visibility row — FormField escape hatch for badge vs select display */}
                        <div className="tw:flex tw:items-start tw:gap-3 tw:px-4 tw:py-3">
                          <div className="tw:basis-[30%] tw:shrink-0">
                            <Typography
                              className="tw:text-quaternary tw:w-28 tw:shrink-0"
                              size="text-sm">
                              {t('label.visibility')}
                            </Typography>
                          </div>
                          <FormField control={form.control} name="visibility">
                            {({ field }) => {
                              const visibilityOption = VISIBILITY_OPTIONS.find(
                                (o) => o.id === field.value
                              );

                              return (
                                <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-2">
                                  {isEditingVisibility || !memoryToEdit ? (
                                    <div className="tw:flex tw:items-center tw:gap-2">
                                      <Select
                                        className="tw:flex-1"
                                        data-testid="memory-visibility-select"
                                        fontSize="sm"
                                        size="sm"
                                        value={field.value}
                                        onChange={(key) =>
                                          field.onChange(key as ShareVisibility)
                                        }>
                                        {VISIBILITY_OPTIONS.map((opt) => (
                                          <Select.Item
                                            id={opt.id}
                                            key={opt.id}
                                            label={t(opt.labelKey)}
                                          />
                                        ))}
                                      </Select>
                                      {memoryToEdit && (
                                        <Button
                                          color="secondary"
                                          size="sm"
                                          onClick={() =>
                                            setIsEditingVisibility(false)
                                          }>
                                          {t('label.cancel')}
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="tw:flex tw:items-center tw:gap-2">
                                      <Badge
                                        className="tw:flex tw:items-center tw:gap-1 tw:uppercase"
                                        color={
                                          visibilityOption?.badgeColor ??
                                          'brand'
                                        }
                                        size="sm"
                                        type="color">
                                        {visibilityOption
                                          ? VISIBILITY_ICON_MAP[
                                              visibilityOption.iconName
                                            ]
                                          : VISIBILITY_ICON_MAP.Share07}
                                        {visibilityOption
                                          ? t(visibilityOption.labelKey)
                                          : t('label.shared')}
                                      </Badge>
                                      {visibilityOption && (
                                        <Typography
                                          className="tw:text-quaternary"
                                          size="text-xs">
                                          {t(visibilityOption.descriptionKey)}
                                        </Typography>
                                      )}
                                      {!isViewOnly && isOwner && (
                                        <ButtonUtility
                                          color="tertiary"
                                          data-testid="memory-visibility-edit-button"
                                          icon={
                                            <EditIcon height={14} width={14} />
                                          }
                                          onClick={() =>
                                            setIsEditingVisibility(true)
                                          }
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            }}
                          </FormField>
                        </div>

                        {/* Tags row */}
                        <div className="tw:flex tw:items-start tw:gap-3 tw:px-4 tw:py-3">
                          <div className="tw:basis-[30%] tw:shrink-0">
                            <Typography
                              className="tw:text-quaternary tw:w-28 tw:shrink-0"
                              size="text-sm">
                              {t('label.tag-plural')}
                            </Typography>
                          </div>
                          <div className="tw:flex-1">{getField(tagsField)}</div>
                        </div>

                        {Boolean(memoryToEdit?.updatedAt) && (
                          <div className="tw:flex tw:items-center tw:gap-3 tw:px-4 tw:py-3">
                            <div className="tw:basis-[30%]">
                              <Typography
                                className="tw:text-quaternary tw:w-28 tw:shrink-0"
                                size="text-sm">
                                {t('label.updated')}
                              </Typography>
                            </div>
                            <Typography
                              className="tw:text-tertiary"
                              size="text-sm">
                              {formatDate(memoryToEdit?.updatedAt)}
                            </Typography>
                          </div>
                        )}
                        {memoryToEdit &&
                          contextCenterClassBase
                            .getMemoryMetadataList(memoryToEdit)
                            .map(({ key, label, value }) => (
                              <div
                                className="tw:flex tw:items-center tw:gap-3 tw:px-4 tw:py-3"
                                key={key}>
                                <div className="tw:basis-[30%]">
                                  <Typography
                                    className="tw:text-quaternary tw:w-28 tw:shrink-0"
                                    size="text-sm">
                                    {label}
                                  </Typography>
                                </div>
                                {value}
                              </div>
                            ))}
                      </Card>
                    </div>
                    {isViewOnly && memoryToEdit?.id && (
                      <DerivedOntologyCard memoryId={memoryToEdit.id} />
                    )}
                  </div>

                  {/* Sticky footer */}
                  <div className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:py-4 tw:border-t tw:border-tertiary tw:shrink-0 tw:px-6">
                    <div>
                      {Boolean(memoryToEdit) && canDelete && (
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
                      {showEditButton && (
                        <Button
                          color="primary"
                          iconLeading={EditIcon}
                          size="sm"
                          onClick={handleSwitchToEdit}>
                          {t('label.edit')}
                        </Button>
                      )}
                      {showSubmitButton && (
                        <Button
                          color="primary"
                          isDisabled={
                            isSubmitDisabled || isSubmitting || isDeleting
                          }
                          isLoading={isSubmitting}
                          size="sm"
                          type="submit">
                          {submitLabel}
                        </Button>
                      )}
                    </div>
                  </div>
                </HookForm>
              </ConfigProvider>
            </div>
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default CreateMemoryModal;
