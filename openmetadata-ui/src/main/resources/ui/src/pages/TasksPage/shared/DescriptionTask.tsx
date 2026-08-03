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
import { isEqual } from 'lodash';
import { FC, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import {
  TaskType,
  Thread,
  ThreadTaskStatus,
} from '../../../generated/entity/feed/thread';
import { getDescriptionDiff } from '../../../utils/TasksUtils';
import { DescriptionTabs } from './DescriptionTabs';
import DiffView from './DiffView/DiffView';

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
        <div className="border border-main p-xs rounded-4 m-y-xss m-b-sm">
          <Typography.Text className="text-grey-muted">
            {t('label.no-entity', { entity: t('label.description') })}
          </Typography.Text>
        </div>
      );
    } else {
      return (
        <DiffView
          className="border border-main p-xs rounded-4 m-y-xss m-b-sm"
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

    return !newDescription && !oldDescription ? (
      <Typography.Text className="text-grey-muted p-xs">
        {t('label.no-entity', { entity: t('label.suggestion') })}
      </Typography.Text>
    ) : (
      <DiffView
        className="p-xs"
        diffArr={getDescriptionDiff(oldDescription ?? '', newDescription ?? '')}
      />
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
                    initialValue={task?.suggestion ?? ''}
                    placeHolder={t('label.add-entity', {
                      entity: t('label.description'),
                    })}
                    style={{ marginTop: '0px' }}
                    onTextChange={onChange}
                  />
                ) : (
                  <div className="d-flex border border-main rounded-4 m-b-md">
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
                  <div className="d-flex border border-main rounded-4 m-b-md">
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
