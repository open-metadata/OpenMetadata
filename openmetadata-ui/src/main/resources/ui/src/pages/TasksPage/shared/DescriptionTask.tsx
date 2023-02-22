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

import RichTextEditor from 'components/common/rich-text-editor/RichTextEditor';
import { EditorContentRef } from 'components/common/rich-text-editor/RichTextEditor.interface';
import { isEqual } from 'lodash';
import React, { FC, Fragment, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TaskType,
  Thread,
  ThreadTaskStatus,
} from '../../../generated/entity/feed/thread';
import { getDescriptionDiff } from '../../../utils/TasksUtils';
import { DescriptionTabs } from './DescriptionTabs';
import { DiffView } from './DiffView';

interface DescriptionTaskProps {
  taskDetail: Thread;
  isTaskActionEdit: boolean;
  hasEditAccess: boolean;
  suggestion: string;
  currentDescription: string;
  onSuggestionChange: (value: string) => void;
}

const DescriptionTask: FC<DescriptionTaskProps> = ({
  taskDetail,
  isTaskActionEdit,
  hasEditAccess,
  suggestion,
  currentDescription,
  onSuggestionChange,
}) => {
  const { t } = useTranslation();
  const markdownRef = useRef<EditorContentRef>();

  const isRequestDescription = isEqual(
    taskDetail.task?.type,
    TaskType.RequestDescription
  );

  const isUpdateDescription = isEqual(
    taskDetail.task?.type,
    TaskType.UpdateDescription
  );

  const isTaskClosed = isEqual(
    taskDetail.task?.status,
    ThreadTaskStatus.Closed
  );

  const getDiffView = () => {
    const oldValue = taskDetail.task?.oldValue;
    const newValue = taskDetail.task?.newValue;
    if (!oldValue && !newValue) {
      return (
        <div className="tw-border tw-border-main tw-p-2 tw-rounded tw-my-1 tw-mb-3">
          <span className="tw-p-2 tw-text-grey-muted">
            {t('label.no-entity', { entity: t('label.description') })}
          </span>
        </div>
      );
    } else {
      return (
        <DiffView
          className="tw-border tw-border-main tw-p-2 tw-rounded tw-my-1 tw-mb-3"
          diffArr={getDescriptionDiff(
            taskDetail?.task?.oldValue || '',
            taskDetail?.task?.newValue || ''
          )}
        />
      );
    }
  };

  /**
   *
   * @returns Suggested description diff
   */
  const getSuggestedDescriptionDiff = () => {
    const newDescription = taskDetail?.task?.suggestion;
    const oldDescription = taskDetail?.task?.oldValue;

    const diffs = getDescriptionDiff(
      oldDescription || '',
      newDescription || ''
    );

    return !newDescription && !oldDescription ? (
      <span className="tw-p-2 tw-text-grey-muted">
        {t('label.no-entity', { entity: t('label.suggestion') })}
      </span>
    ) : (
      <DiffView className="tw-p-2" diffArr={diffs} />
    );
  };

  return (
    <div data-testid="task-description-tabs">
      <p className="tw-text-grey-muted">{`${t('label.description')}:`}</p>{' '}
      <Fragment>
        {isTaskClosed ? (
          getDiffView()
        ) : (
          <div data-testid="description-task">
            {isRequestDescription && (
              <div data-testid="request-description">
                {isTaskActionEdit && hasEditAccess ? (
                  <RichTextEditor
                    height="208px"
                    initialValue={suggestion}
                    placeHolder={t('label.add-entity', {
                      entity: t('label.description'),
                    })}
                    style={{ marginTop: '0px' }}
                    onTextChange={onSuggestionChange}
                  />
                ) : (
                  <div className="tw-flex tw-border tw-border-main tw-rounded tw-mb-4">
                    {getSuggestedDescriptionDiff()}
                  </div>
                )}
              </div>
            )}

            {isUpdateDescription && (
              <div data-testid="update-description">
                {isTaskActionEdit && hasEditAccess ? (
                  <DescriptionTabs
                    description={currentDescription}
                    markdownRef={markdownRef}
                    suggestion={suggestion}
                    onChange={onSuggestionChange}
                  />
                ) : (
                  <div className="tw-flex tw-border tw-border-main tw-rounded tw-mb-4">
                    {getSuggestedDescriptionDiff()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Fragment>
    </div>
  );
};

export default DescriptionTask;
