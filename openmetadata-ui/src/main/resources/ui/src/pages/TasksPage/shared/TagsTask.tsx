/*
 *  Copyright 2022 Collate.
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
import {
  TaskType,
  Thread,
  ThreadTaskStatus,
} from '../../../generated/entity/feed/thread';
import { TagLabel } from '../../../generated/type/tagLabel';
import { TagsDiffView } from './TagsDiffView';
import { TagsTabs } from './TagsTabs';
import TagSuggestion from './TagSuggestion';

interface TagsTaskProps {
  task: Thread['task'];
  isTaskActionEdit: boolean;
  hasEditAccess: boolean;
  value?: TagLabel[];
  onChange?: (newTags: TagLabel[]) => void;
}

const TagsTask: FC<TagsTaskProps> = ({
  value,
  isTaskActionEdit,
  hasEditAccess,
  task,
  onChange,
}) => {
  const { t } = useTranslation();

  const { oldValue, newValue, suggestion } = task || {};

  const isRequestTag = task?.type === TaskType.RequestTag;

  const isUpdateTag = task?.type === TaskType.UpdateTag;

  const isTaskClosed = task?.status === ThreadTaskStatus.Closed;

  const diffView = useMemo(() => {
    if (!oldValue && !newValue) {
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
            JSON.parse(oldValue ?? '[]'),
            JSON.parse(newValue ?? '[]')
          )}
        />
      );
    }
  }, [oldValue, newValue]);

  /**
   *
   * @returns Suggested tags diff
   */
  const suggestedTagsDiff = useMemo(() => {
    if (!suggestion && !oldValue) {
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
            JSON.parse(oldValue ?? '[]'),
            JSON.parse(suggestion ?? '[]')
          )}
        />
      );
    }
  }, [suggestion, oldValue]);

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
                    tags={JSON.parse(oldValue ?? '[]')}
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

export default TagsTask;
