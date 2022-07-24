/*
 *  Copyright 2021 Collate
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

import { diffArrays } from 'diff';
import React, { FC, Fragment } from 'react';
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
  currentTags: TagLabel[];
  suggestions: TagLabel[];
  setSuggestion: (value: TagLabel[]) => void;
}

const TagsTask: FC<TagsTaskProps> = ({
  suggestions,
  setSuggestion,
  isTaskActionEdit,
  hasEditAccess,
  task,
  currentTags,
}) => {
  const isRequestTag = task?.type === TaskType.RequestTag;

  const isUpdateTag = task?.type === TaskType.UpdateTag;

  const isTaskClosed = task?.status === ThreadTaskStatus.Closed;

  const getDiffView = () => {
    const oldValue = task?.oldValue;
    const newValue = task?.newValue;
    if (!oldValue && !newValue) {
      return (
        <div className="tw-border tw-border-main tw-p-2 tw-rounded tw-my-1 tw-mb-3">
          <span className="tw-p-2 tw-text-grey-muted">No Tags</span>
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
  };

  /**
   *
   * @returns Suggested tags diff
   */
  const getSuggestedTagDiff = () => {
    const newTags = task?.suggestion;
    const oldTags = task?.oldValue;

    return !newTags && !oldTags ? (
      <span className="tw-p-2 tw-text-grey-muted">No Suggestion</span>
    ) : (
      <TagsDiffView
        diffArr={diffArrays(
          JSON.parse(oldTags ?? '[]'),
          JSON.parse(newTags ?? '[]')
        )}
      />
    );
  };

  return (
    <div data-testid="task-tags-tabs">
      <p className="tw-text-grey-muted">Tags:</p>{' '}
      <Fragment>
        {isTaskClosed ? (
          getDiffView()
        ) : (
          <div data-testid="tags-task">
            {isRequestTag && (
              <div data-testid="request-tags">
                {isTaskActionEdit && hasEditAccess ? (
                  <TagSuggestion
                    selectedTags={suggestions}
                    onChange={setSuggestion}
                  />
                ) : (
                  getSuggestedTagDiff()
                )}
              </div>
            )}
            {isUpdateTag && (
              <div data-testid="update-tags">
                {isTaskActionEdit && hasEditAccess ? (
                  <TagsTabs
                    suggestedTags={suggestions}
                    tags={currentTags}
                    onChange={setSuggestion}
                  />
                ) : (
                  getSuggestedTagDiff()
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
