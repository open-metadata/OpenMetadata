/*
 *  Copyright 2024 Collate.
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

import { Typography } from 'antd';
import { diffArrays } from 'diff';
import { FC, Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TagLabel } from '../../../generated/type/tagLabel';
import { Task, TaskEntityStatus, TaskEntityType } from '../../../rest/tasksAPI';
import { TagsDiffView } from './TagsDiffView';
import { TagsTabs } from './TagsTabs';
import TagSuggestion from './TagSuggestion';

interface TagsTaskFromTaskProps {
  task: Task;
  isTaskActionEdit?: boolean;
  hasEditAccess: boolean;
  value?: TagLabel[];
  onChange?: (newTags: TagLabel[]) => void;
}

const TagsTaskFromTask: FC<TagsTaskFromTaskProps> = ({
  value,
  isTaskActionEdit = false,
  hasEditAccess,
  task,
  onChange,
}) => {
  const { t } = useTranslation();

  const payload = task.payload;

  // Support both new payload format (tagsToAdd, currentTags) and old format (suggestedValue, currentValue)
  const currentTags: TagLabel[] = useMemo(() => {
    if (payload?.currentTags) {
      return payload.currentTags as TagLabel[];
    }
    if (payload?.currentValue) {
      try {
        return JSON.parse(payload.currentValue as string);
      } catch {
        return [];
      }
    }

    return [];
  }, [payload]);

  const suggestedTags: TagLabel[] = useMemo(() => {
    // For new format: combine currentTags with tagsToAdd, minus tagsToRemove
    if (payload?.tagsToAdd || payload?.tagsToRemove) {
      const tagsToAdd = (payload.tagsToAdd as TagLabel[]) ?? [];
      const tagsToRemove = (payload.tagsToRemove as TagLabel[]) ?? [];
      const current = (payload.currentTags as TagLabel[]) ?? [];
      const removeFQNs = new Set(tagsToRemove.map((t) => t.tagFQN));

      // Filter out removed tags and add new tags
      const result = current.filter((t) => !removeFQNs.has(t.tagFQN));

      return [...result, ...tagsToAdd];
    }
    // Old format: parse JSON string
    if (payload?.suggestedValue) {
      try {
        return JSON.parse(payload.suggestedValue as string);
      } catch {
        return [];
      }
    }

    return [];
  }, [payload]);

  // For backwards compatibility with components that use JSON strings
  const currentValue =
    currentTags.length > 0 ? JSON.stringify(currentTags) : undefined;
  const suggestedValue =
    suggestedTags.length > 0 ? JSON.stringify(suggestedTags) : undefined;

  const isRequestTag = task.type === TaskEntityType.TagUpdate && !currentValue;

  const isUpdateTag =
    task.type === TaskEntityType.TagUpdate && Boolean(currentValue);

  const isTaskClosed = [
    TaskEntityStatus.Completed,
    TaskEntityStatus.Cancelled,
    TaskEntityStatus.Rejected,
    TaskEntityStatus.Failed,
  ].includes(task.status);

  const diffView = useMemo(() => {
    if (!currentValue && !suggestedValue) {
      return (
        <div>
          <Typography.Text className="text-grey-muted border border-main p-sm rounded-4 m-y-xss m-b-xs">
            {t('label.no-entity', { entity: t('label.tag-plural') })}
          </Typography.Text>
        </div>
      );
    } else {
      return (
        <TagsDiffView
          diffArr={diffArrays(
            JSON.parse(currentValue ?? '[]'),
            JSON.parse(suggestedValue ?? '[]')
          )}
        />
      );
    }
  }, [currentValue, suggestedValue]);

  const suggestedTagsDiff = useMemo(() => {
    if (!suggestedValue && !currentValue) {
      return (
        <Typography.Text
          className="text-grey-muted p-xs"
          data-testid="no-suggestion">
          {t('label.no-entity', { entity: t('label.suggestion') })}
        </Typography.Text>
      );
    } else {
      return (
        <TagsDiffView
          diffArr={diffArrays(
            JSON.parse(currentValue ?? '[]'),
            JSON.parse(suggestedValue ?? '[]')
          )}
        />
      );
    }
  }, [suggestedValue, currentValue]);

  return (
    <div data-testid="task-tags-tabs">
      <Fragment>
        {isTaskClosed ? (
          diffView
        ) : (
          <div data-testid="tags-task">
            {isRequestTag && (
              <div data-testid="request-tags">
                {isTaskActionEdit && hasEditAccess ? (
                  <TagSuggestion value={value} onChange={onChange} />
                ) : (
                  suggestedTagsDiff
                )}
              </div>
            )}
            {isUpdateTag && (
              <div data-testid="update-tags">
                {isTaskActionEdit && hasEditAccess ? (
                  <TagsTabs
                    tags={JSON.parse(currentValue ?? '[]')}
                    value={value ?? []}
                    onChange={onChange}
                  />
                ) : (
                  suggestedTagsDiff
                )}
              </div>
            )}
          </div>
        )}
      </Fragment>
    </div>
  );
};

export default TagsTaskFromTask;
