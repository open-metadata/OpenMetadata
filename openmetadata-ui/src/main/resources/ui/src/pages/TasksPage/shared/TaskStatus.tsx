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

import classNames from 'classnames';
import React from 'react';
import { ThreadTaskStatus } from '../../../generated/entity/feed/thread';

const TaskStatus = ({ status }: { status: ThreadTaskStatus }) => {
  const openCheck = status === ThreadTaskStatus.Open;
  const closedCheck = status === ThreadTaskStatus.Closed;

  return (
    <div
      className={classNames(
        'tw-rounded-3xl tw-px-2 tw-p-0',
        {
          'tw-bg-task-status-bg': openCheck,
        },
        { 'tw-bg-gray-100': closedCheck }
      )}
      data-testid="task-status">
      <span
        className={classNames(
          'tw-inline-block tw-w-2 tw-h-2 tw-rounded-full',
          {
            'tw-bg-task-status-fg': openCheck,
          },
          {
            'tw-bg-gray-500': closedCheck,
          }
        )}
        data-testid="task-status-badge"
      />
      <span
        className={classNames(
          'tw-ml-1',
          { 'tw-text-task-status-fg': openCheck },
          { 'tw-text-gray-500': closedCheck }
        )}
        data-testid="task-status-text">
        {status}
      </span>
    </div>
  );
};

export default TaskStatus;
