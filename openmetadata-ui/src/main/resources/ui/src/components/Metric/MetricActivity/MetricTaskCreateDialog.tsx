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
  Checkbox,
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  Select,
  Skeleton,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import {
  LabelType,
  State,
  TagSource,
} from '../../../generated/api/tasks/createTask';
import { Metric } from '../../../generated/entity/data/metric';
import { searchQuery } from '../../../rest/searchAPI';
import {
  CreateTask,
  TaskCategory,
  TaskEntityType,
  TaskPriority,
} from '../../../rest/tasksAPI';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';

interface TaskPickerOption {
  id: string;
  label: string;
  source?: TagSource;
  type: string;
  value: string;
}

interface TaskPickerSearchResponse {
  hits: {
    hits: Array<{
      _id: string;
      _source: {
        displayName?: string;
        entityType?: string;
        fullyQualifiedName?: string;
        name?: string;
      };
    }>;
  };
}

interface TaskOptionPickerProps {
  dataTestId: string;
  hasMore: boolean;
  isFetchingMore: boolean;
  isLoading: boolean;
  label: string;
  loadMoreLabel: string;
  options: TaskPickerOption[];
  search: string;
  selected: Map<string, TaskPickerOption>;
  onLoadMore: () => void;
  onSearchChange: (value: string) => void;
  onToggle: (option: TaskPickerOption) => void;
}

const TaskOptionPicker = ({
  dataTestId,
  hasMore,
  isFetchingMore,
  isLoading,
  label,
  loadMoreLabel,
  options,
  search,
  selected,
  onLoadMore,
  onSearchChange,
  onToggle,
}: TaskOptionPickerProps) => (
  <Box direction="col" gap={2}>
    <Typography size="text-sm" weight="medium">
      {label}
    </Typography>
    <Input
      aria-label={label}
      inputDataTestId={`${dataTestId}-search`}
      placeholder={label}
      value={search}
      onChange={onSearchChange}
    />
    <ul
      aria-label={label}
      className="tw:flex tw:max-h-44 tw:list-none tw:flex-col tw:overflow-y-auto tw:rounded-lg tw:border tw:border-secondary tw:p-1"
      data-testid={dataTestId}>
      {isLoading
        ? Array.from({ length: 3 }, (_, index) => (
            <li key={index}>
              <Skeleton height={36} variant="rounded" />
            </li>
          ))
        : options.map((option) => (
            <li
              className="tw:rounded-md tw:px-2 tw:py-1.5 tw:hover:bg-primary_hover"
              key={option.id}>
              <Box align="center" gap={2}>
                <Checkbox
                  aria-label={option.label}
                  isSelected={selected.has(option.id)}
                  onChange={() => onToggle(option)}
                />
                <Box className="tw:min-w-0" direction="col">
                  <Typography ellipsis size="text-sm" weight="medium">
                    {option.label}
                  </Typography>
                  <Typography
                    ellipsis
                    className="tw:text-tertiary"
                    size="text-xs">
                    {option.value}
                  </Typography>
                </Box>
              </Box>
            </li>
          ))}
    </ul>
    {hasMore && (
      <Button
        aria-label={`${loadMoreLabel} ${label}`}
        color="secondary"
        data-testid={`${dataTestId}-load-more`}
        isLoading={isFetchingMore}
        size="sm"
        onPress={onLoadMore}>
        {loadMoreLabel}
      </Button>
    )}
  </Box>
);

export interface MetricTaskCreateDialogProps {
  error?: unknown;
  isLoading?: boolean;
  metric: Metric;
  open: boolean;
  onClose: () => void;
  onCreate: (task: CreateTask) => Promise<unknown>;
}

const MetricTaskCreateDialog = ({
  error,
  isLoading,
  metric,
  open,
  onClose,
  onCreate,
}: MetricTaskCreateDialogProps) => {
  const { t } = useTranslation();
  const [taskType, setTaskType] = useState(TaskEntityType.DescriptionUpdate);
  const [title, setTitle] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [assigneeLimit, setAssigneeLimit] = useState(10);
  const [tagSearch, setTagSearch] = useState('');
  const [tagLimit, setTagLimit] = useState(10);
  const [proposedDescription, setProposedDescription] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<
    Map<string, TaskPickerOption>
  >(new Map());
  const [selectedTags, setSelectedTags] = useState<
    Map<string, TaskPickerOption>
  >(new Map());
  const assigneeResult = useQuery({
    queryKey: ['metric-task-assignee-search', assigneeSearch, assigneeLimit],
    queryFn: () =>
      searchQuery<
        (SearchIndex.USER | SearchIndex.TEAM)[],
        'displayName' | 'entityType' | 'fullyQualifiedName' | 'name'
      >({
        fetchSource: true,
        includeFields: [
          'displayName',
          'entityType',
          'fullyQualifiedName',
          'name',
        ],
        pageNumber: 1,
        pageSize: assigneeLimit,
        query: assigneeSearch,
        searchIndex: [SearchIndex.USER, SearchIndex.TEAM],
      }),
    enabled: open,
  });
  const tagResult = useQuery({
    queryKey: ['metric-task-tag-search', tagSearch, tagLimit],
    queryFn: () =>
      searchQuery<
        (SearchIndex.TAG | SearchIndex.GLOSSARY_TERM)[],
        'displayName' | 'entityType' | 'fullyQualifiedName' | 'name'
      >({
        fetchSource: true,
        includeFields: [
          'displayName',
          'entityType',
          'fullyQualifiedName',
          'name',
        ],
        pageNumber: 1,
        pageSize: tagLimit,
        query: tagSearch,
        searchIndex: [SearchIndex.TAG, SearchIndex.GLOSSARY_TERM],
      }),
    enabled: open && taskType === TaskEntityType.TagUpdate,
  });
  const toOptions = (
    result: TaskPickerSearchResponse | undefined,
    includeTagSource: boolean
  ): TaskPickerOption[] =>
    (result?.hits.hits ?? []).flatMap((hit) => {
      const source = hit._source;
      const value = source.fullyQualifiedName ?? source.name;
      const type = source.entityType;
      if (!value || !type) {
        return [];
      }

      return [
        {
          id: hit._id,
          label: source.displayName ?? source.name ?? value,
          source: includeTagSource
            ? type === EntityType.GLOSSARY_TERM
              ? TagSource.Glossary
              : TagSource.Classification
            : undefined,
          type,
          value,
        },
      ];
    });
  const assigneeOptions = toOptions(assigneeResult.data, false);
  const tagOptions = toOptions(tagResult.data, true);
  const hasMoreAssignees =
    (assigneeResult.data?.hits.total?.value ?? 0) > assigneeOptions.length;
  const hasMoreTags =
    (tagResult.data?.hits.total?.value ?? 0) > tagOptions.length;
  const canSubmit =
    Boolean(title.trim()) &&
    selectedAssignees.size > 0 &&
    (taskType === TaskEntityType.DescriptionUpdate
      ? Boolean(proposedDescription.trim())
      : selectedTags.size > 0);

  useEffect(() => {
    setAssigneeLimit(10);
  }, [assigneeSearch]);

  useEffect(() => {
    setTagLimit(10);
  }, [tagSearch]);

  useEffect(() => {
    if (!open) {
      setTaskType(TaskEntityType.DescriptionUpdate);
      setTitle('');
      setAssigneeSearch('');
      setAssigneeLimit(10);
      setTagSearch('');
      setTagLimit(10);
      setProposedDescription('');
      setSelectedAssignees(new Map());
      setSelectedTags(new Map());
    }
  }, [open]);

  const handleCreate = async () => {
    const currentTags = (metric.tags ?? []).map((tag) => ({
      labelType: LabelType.Manual,
      source:
        tag.source === 'Glossary'
          ? TagSource.Glossary
          : TagSource.Classification,
      state: State.Confirmed,
      tagFQN: tag.tagFQN,
    }));
    const payload =
      taskType === TaskEntityType.DescriptionUpdate
        ? {
            currentDescription: metric.description ?? '',
            fieldPath: 'description',
            newDescription: proposedDescription.trim(),
          }
        : {
            currentTags,
            fieldPath: '',
            operation: 'Add',
            tagsToAdd: [...selectedTags.values()].map((tag) => ({
              labelType: LabelType.Manual,
              source: tag.source ?? TagSource.Classification,
              state: State.Suggested,
              tagFQN: tag.value,
            })),
            tagsToRemove: [],
          };

    await onCreate({
      about: getEntityFeedLink(
        EntityType.METRIC,
        metric.fullyQualifiedName ?? ''
      ),
      assignees: [...selectedAssignees.values()].map(({ value }) => value),
      category: TaskCategory.MetadataUpdate,
      name: title.trim(),
      payload,
      priority: TaskPriority.Medium,
      type: taskType,
    });
    onClose();
  };

  return (
    <ModalOverlay isDismissable isOpen={open} onOpenChange={onClose}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="metric-task-create-dialog"
          title={t('label.create-entity', { entity: t('label.task') })}
          width={640}
          onClose={onClose}>
          <Dialog.Content>
            {Boolean(error) && (
              <Alert
                data-testid="metric-task-create-error"
                title={t('server.create-entity-error', {
                  entity: t('label.task'),
                })}
                variant="error"
              />
            )}
            <Select
              aria-label={t('label.type')}
              data-testid="metric-task-create-type"
              value={taskType}
              onChange={(value) => setTaskType(value as TaskEntityType)}>
              <Select.Item
                id={TaskEntityType.DescriptionUpdate}
                label={t('label.update-description')}
              />
              <Select.Item
                id={TaskEntityType.TagUpdate}
                label={t('label.update-entity', {
                  entity: t('label.tag-plural'),
                })}
              />
            </Select>
            <Input
              aria-label={t('label.title')}
              inputDataTestId="metric-task-create-title"
              placeholder={t('label.title')}
              value={title}
              onChange={setTitle}
            />
            <TaskOptionPicker
              dataTestId="metric-task-create-assignees"
              hasMore={hasMoreAssignees}
              isFetchingMore={
                assigneeResult.isFetching && !assigneeResult.isPending
              }
              isLoading={assigneeResult.isPending}
              label={t('label.assignee-plural')}
              loadMoreLabel={t('label.load-more')}
              options={assigneeOptions}
              search={assigneeSearch}
              selected={selectedAssignees}
              onLoadMore={() => setAssigneeLimit((current) => current + 10)}
              onSearchChange={setAssigneeSearch}
              onToggle={(option) =>
                setSelectedAssignees((current) => {
                  const next = new Map(current);
                  if (next.has(option.id)) {
                    next.delete(option.id);
                  } else {
                    next.set(option.id, option);
                  }

                  return next;
                })
              }
            />
            {taskType === TaskEntityType.DescriptionUpdate ? (
              <TextArea
                aria-label={t('label.description')}
                data-testid="metric-task-create-value"
                placeholder={t('label.description')}
                rows={5}
                value={proposedDescription}
                onChange={setProposedDescription}
              />
            ) : (
              <TaskOptionPicker
                dataTestId="metric-task-create-tags"
                hasMore={hasMoreTags}
                isFetchingMore={tagResult.isFetching && !tagResult.isPending}
                isLoading={tagResult.isPending}
                label={t('label.tag-plural')}
                loadMoreLabel={t('label.load-more')}
                options={tagOptions}
                search={tagSearch}
                selected={selectedTags}
                onLoadMore={() => setTagLimit((current) => current + 10)}
                onSearchChange={setTagSearch}
                onToggle={(option) =>
                  setSelectedTags((current) => {
                    const next = new Map(current);
                    if (next.has(option.id)) {
                      next.delete(option.id);
                    } else {
                      next.set(option.id, option);
                    }

                    return next;
                  })
                }
              />
            )}
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" onPress={onClose}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="metric-task-create-submit"
              isDisabled={!canSubmit || isLoading}
              isLoading={isLoading}
              onPress={handleCreate}>
              {t('label.create')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default MetricTaskCreateDialog;
