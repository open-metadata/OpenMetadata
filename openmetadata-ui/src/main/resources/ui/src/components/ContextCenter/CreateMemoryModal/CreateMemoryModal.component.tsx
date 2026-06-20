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
  BadgeWithButton,
  Box,
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
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import {
  FC,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import {
  formatDate,
  getShortRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getErrorText } from '../../../utils/StringUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { showSuccessToast } from '../../../utils/ToastUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import DataAssetSelectList from '../../DataAssets/DataAssetSelectList/DataAssetSelectList';
import { CreateMemoryModalProps } from './CreateMemoryModal.interface';

const TagSelectForm = withSuspenseFallback(
  lazy(
    () =>
      import('../../../components/Tag/TagsSelectForm/TagsSelectForm.component')
  )
);

const LinkedAssetCard: FC<{
  asset: DataAssetOption;
  onRemove?: (fqn: string) => void;
}> = ({ asset, onRemove }) => {
  const displayName =
    asset.displayName || (typeof asset.label === 'string' ? asset.label : '');

  const fqn = asset.reference?.fullyQualifiedName ?? String(asset.value ?? '');

  return (
    <Card className="tw:flex tw:items-center tw:gap-2.5 tw:px-3 tw:py-2.5">
      <div className="tw:shrink-0">
        {getEntityIconWithBg(asset.reference?.type, { className: 'tw:w-8 tw:h-8' }, { size: 18 })}
      </div>
      <Box align='center' className="tw:flex-1 tw:min-w-0 tw:gap-2.5" justify='between'>
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
            className="tw:text-gray-700 tw:leading-tight"
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

const VISIBILITY_ICON_MAP = {
  Share07: <Share07 size={12} strokeWidth={2} />,
  Database01: <Database01 size={12} strokeWidth={2} />,
  FileLock02: <FileLock02 size={12} strokeWidth={2} />,
};

const CreateMemoryModal: FC<CreateMemoryModalProps> = ({
  memoryToEdit,
  isOpen,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
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

  const [title, setTitle] = useState('');
  const [memory, setMemory] = useState('');
  const [memoryTab, setMemoryTab] = useState<'edit' | 'preview'>('edit');
  const [memoryType, setMemoryType] = useState<MemoryType | ''>('');
  const [visibility, setVisibility] = useState<ShareVisibility>(
    ShareVisibility.Shared
  );
  const [isEditingVisibility, setIsEditingVisibility] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalError, setModalError] = useState<string>('');

  const [linkedAssets, setLinkedAssets] = useState<DataAssetOption[]>([]);
  const [selectedTags, setSelectedTags] = useState<TagLabel[]>([]);
  const [showTagForm, setShowTagForm] = useState(false);

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

  useEffect(() => {
    setIsViewOnly(viewOnly);
  }, [viewOnly]);

  useEffect(() => {
    if (memoryToEdit) {
      setTitle(memoryToEdit.title ?? '');
      setMemory(memoryToEdit.answer ?? memoryToEdit.question ?? '');
      setMemoryType(memoryToEdit.memoryType ?? '');
      setVisibility(
        memoryToEdit.shareConfig?.visibility ?? ShareVisibility.Shared
      );
      setSelectedTags(memoryToEdit.tags ?? []);
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
      setTitle('');
      setMemory('');
      setMemoryType('');
      setVisibility(ShareVisibility.Shared);
      setSelectedTags([]);
      setLinkedAssets([]);
    }
    setShowTagForm(false);
    setModalError('');
    setIsEditingVisibility(false);
  }, [memoryToEdit]);

  const handleClose = () => {
    setTitle('');
    setMemory('');
    setMemoryType('');
    setVisibility(ShareVisibility.Shared);
    setLinkedAssets([]);
    setSelectedTags([]);
    setShowTagForm(false);
    setModalError('');
    setIsEditingVisibility(false);
    setIsViewOnly(viewOnly);
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
    setModalError('');
    try {
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
          memoryType: memoryType || undefined,
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
          ...(memoryType ? { memoryType } : {}),
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
    } finally {
      setIsSubmitting(false);
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

  const visibilityOption = VISIBILITY_OPTIONS.find((o) => o.id === visibility);

  const renderMemoryContent = () => {
    if (isViewOnly) {
      return (
        <div className="prose tw:p-3 tw:rounded-lg tw:border tw:border-gray-200 tw:bg-gray-50 tw:h-36 tw:overflow-y-auto tw:resize-y">
          <ReactMarkdown components={getCustomMarkdownComponents()}>
            {preprocessMarkdownText(memory)}
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
          value={memory}
          onChange={(value) => setMemory(value)}
        />
      );
    }

    return (
      <div className="prose tw:p-3 tw:rounded-lg tw:border tw:border-gray-200 tw:bg-gray-100 tw:text-secondary tw:h-36 tw:overflow-y-auto tw:resize-y">
        {memory.trim() ? (
          <ReactMarkdown components={getCustomMarkdownComponents()}>
            {preprocessMarkdownText(memory)}
          </ReactMarkdown>
        ) : (
          <Typography className="tw:text-gray-400" size="text-sm">
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
            <div
              className="tw:flex tw:flex-col tw:max-h-[92vh]"
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
                    {(memoryToEdit?.owners?.[0]?.name ??
                      memoryToEdit?.updatedBy) && (
                      <div className="tw:flex tw:items-center tw:gap-1">
                        <Typography className="tw:text-gray-500" size="text-xs">
                          {t('label.created-by')}
                        </Typography>
                        <UserPopOverCard
                          showUserName
                          className="tw:text-primary"
                          profileWidth={16}
                          userName={memoryToEdit?.owners?.[0]?.name || ''}
                        />
                        <span className="tw:text-gray-400 tw:leading-none tw:select-none tw:text-xl">
                          &middot;
                        </span>
                        <Typography className="tw:text-gray-500" size="text-xs">
                          {formatDate(memoryToEdit.updatedAt)}
                        </Typography>
                      </div>
                    )}
                    {memorySource && memorySourceLink && (
                      <div className="tw:flex tw:items-center tw:gap-1">
                        <FileLock02
                          className="tw:shrink-0 tw:text-gray-400"
                          size={12}
                          strokeWidth={2}
                        />
                        <Typography className="tw:text-gray-500" size="text-xs">
                          {t('label.extracted-from')}
                        </Typography>
                        <Link
                          className="tw:text-xs tw:font-medium tw:text-brand-600 tw:hover:underline tw:truncate"
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

                  {/* Section 1: Title */}
                  <div className="tw:flex tw:flex-col tw:gap-1">
                    <Input
                      data-testid="memory-title-input"
                      isDisabled={isViewOnly}
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
                      <div className="tw:flex tw:items-center tw:gap-1">
                        <Typography
                          className="tw:text-secondary"
                          size="text-sm"
                          weight="medium">
                          {t('label.memory')}
                          {!isViewOnly && (
                            <span className="tw:text-error-primary tw:ml-0.5">
                              *
                            </span>
                          )}
                        </Typography>
                        <Tooltip
                          title={t('message.what-should-ask-collate-remember')}>
                          <TooltipTrigger className="tw:leading-0">
                            <InfoCircle
                              className="tw:text-gray-400 tw:cursor-pointer"
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
                    {renderMemoryContent()}
                  </div>

                  {/* Section 3: Type */}
                  <div className="tw:flex tw:flex-col tw:gap-1">
                    <Select
                      data-testid="memory-type-select"
                      isDisabled={isViewOnly}
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
                    <Card className="tw:flex tw:flex-col tw:divide-y tw:divide-gray-100 tw:mt-2">
                      {/* Visibility row */}
                      <div className="tw:flex tw:items-start tw:gap-3 tw:px-4 tw:py-3">
                        <div className="tw:basis-[30%] tw:shrink-0">
                          <Typography
                            className="tw:text-gray-500 tw:w-28 tw:shrink-0"
                            size="text-sm">
                            {t('label.visibility')}
                          </Typography>
                        </div>
                        <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-2">
                          {isEditingVisibility || !memoryToEdit ? (
                            <div className="tw:flex tw:items-center tw:gap-2">
                              <Select
                                className="tw:flex-1"
                                data-testid="memory-visibility-select"
                                fontSize="sm"
                                size="sm"
                                value={visibility}
                                onChange={(key) =>
                                  setVisibility(key as ShareVisibility)
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
                                  onClick={() => setIsEditingVisibility(false)}>
                                  {t('label.cancel')}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="tw:flex tw:items-center tw:gap-2">
                              <Badge
                                className="tw:flex tw:items-center tw:gap-1 tw:uppercase"
                                color={visibilityOption?.badgeColor ?? 'brand'}
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
                                  className="tw:text-gray-500"
                                  size="text-xs">
                                  {t(visibilityOption.descriptionKey)}
                                </Typography>
                              )}
                              {!isViewOnly && isOwner && (
                                <ButtonUtility
                                  color="tertiary"
                                  icon={<EditIcon height={14} width={14} />}
                                  onClick={() => setIsEditingVisibility(true)}
                                />
                              )}
                            </div>
                          )}
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
                              isViewOnly ? (
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
                                    className="tw:text-secondary"
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
                                      className="tw:text-secondary"
                                      size="text-xs">
                                      {tag.tagFQN}
                                    </Typography>
                                  </div>
                                </BadgeWithButton>
                              )
                            )}
                            {!isViewOnly && (
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

                        {showTagForm && !isViewOnly && (
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
                            className="tw:text-tertiary"
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
                          <div className="tw:flex tw:items-center tw:gap-1">
                            <Typography
                              className="tw:text-tertiary"
                              size="text-sm"
                              weight="semibold">
                              {t('label.n-times', {
                                count: memoryToEdit.usageCount,
                              })}
                            </Typography>
                            {memoryToEdit.lastUsedAt !== undefined && (
                              <>
                                <span className="tw:text-gray-400 tw:select-none tw:mx-1">
                                  &middot;
                                </span>
                                <Typography
                                  className="tw:text-gray-500"
                                  size="text-sm">
                                  {`${t('label.last')} ${getShortRelativeTime(
                                    memoryToEdit.lastUsedAt
                                  )}`}
                                </Typography>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </Card>
                  </div>
                </div>

                {/* Sticky footer */}
                <div className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:py-4 tw:border-t tw:border-gray-100 tw:shrink-0 tw:px-6">
                  <div>
                    {(isEditMode || (isViewOnly && canDelete)) && (
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
                    {isViewOnly && (isOwner || canDelete) ? (
                      <Button
                        color="primary"
                        iconLeading={EditIcon}
                        size="sm"
                        onClick={handleSwitchToEdit}>
                        {t('label.edit')}
                      </Button>
                    ) : !isViewOnly ? (
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
                    ) : null}
                  </div>
                </div>
              </ConfigProvider>
            </div>
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default CreateMemoryModal;
