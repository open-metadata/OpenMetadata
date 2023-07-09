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
import { isEqual } from 'lodash';
import React, { FC, Fragment } from 'react';
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
  taskThread: Thread;
  isTaskActionEdit: boolean;
  hasEditAccess: boolean;
  onChange: (value: string) => void;
}

const DescriptionTask: FC<DescriptionTaskProps> = ({
  taskThread,
  isTaskActionEdit,
  hasEditAccess,
  onChange,
}) => {
  const { task } = taskThread;
  const { t } = useTranslation();

  const isRequestDescription = isEqual(task?.type, TaskType.RequestDescription);

  const isUpdateDescription = isEqual(task?.type, TaskType.UpdateDescription);

  const isTaskClosed = isEqual(task?.status, ThreadTaskStatus.Closed);

  const getDiffView = () => {
    const oldValue = task?.oldValue;
    const newValue = task?.newValue;
    if (!oldValue && !newValue) {
      return (
        <div className="tw-border tw-border-main tw-p-2 tw-rounded tw-my-1 tw-mb-3">
          <span className="tw-p-2 text-grey-muted">
            {t('label.no-entity', { entity: t('label.description') })}
          </span>
        </div>
      );
    } else {
      return (
        <DiffView
          className="tw-border tw-border-main tw-p-2 tw-rounded tw-my-1 tw-mb-3"
          diffArr={getDescriptionDiff(oldValue ?? '', newValue ?? '')}
        />
      );
    }
  };

  /**
   *
   * @returns Suggested description diff
   */
  const getSuggestedDescriptionDiff = () => {
    const newDescription = task?.suggestion;
    const oldDescription = task?.oldValue;

    const diffs = getDescriptionDiff(
      oldDescription || '',
      newDescription || ''
    );

    return !newDescription && !oldDescription ? (
      <span className="tw-p-2 text-grey-muted">
        {t('label.no-entity', { entity: t('label.suggestion') })}
      </span>
    ) : (
      <DiffView className="tw-p-2" diffArr={diffs} />
    );
  };

  return (
    <div data-testid="task-description-tabs">
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
                    initialValue={task?.suggestion ?? ''}
                    placeHolder={t('label.add-entity', {
                      entity: t('label.description'),
                    })}
                    style={{ marginTop: '0px' }}
                    onTextChange={onChange}
                  />
                ) : (
                  <div className="d-flex tw-border tw-border-main tw-rounded tw-mb-4">
                    {getSuggestedDescriptionDiff()}
                  </div>
                )}
              </div>
            )}

            {isUpdateDescription && (
              <div data-testid="update-description">
                {isTaskActionEdit && hasEditAccess ? (
                  <DescriptionTabs
                    suggestion={task?.suggestion ?? ''}
                    value={task?.oldValue ?? ''}
                    onChange={onChange}
                  />
                ) : (
                  <div className="d-flex tw-border tw-border-main tw-rounded tw-mb-4">
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
