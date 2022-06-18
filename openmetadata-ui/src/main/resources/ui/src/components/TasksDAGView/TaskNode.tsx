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
import { NodeProps } from 'react-flow-renderer';

const TaskNode = (props: NodeProps) => {
  const { data } = props;
  /* eslint-disable-next-line */
  const { label, taskStatus } = data;

  return (
    <div className="tw-relative nowheel ">
      {/* Node label could be simple text or reactNode */}
      <div className={classNames('tw-px-2')} data-testid="node-label">
        {label}
      </div>

      {taskStatus?.length ? (
        <hr className="tw-my-2 tw--mx-3" data-testid="label-separator" />
      ) : null}
      <section
        className={classNames('tw--mx-3 tw-px-3', {
          'tw-h-10 tw-overflow-y-auto': taskStatus?.length,
        })}
        id="table-columns">
        <div className="tw-flex tw-flex-col tw-gap-y-1 tw-relative">
          {taskStatus?.map((c: { name: string; executionStatus: string }) => (
            <div
              className="tw-p-1 tw-text-grey-body"
              data-testid="task-status"
              key={c.name}>
              Status: {c.executionStatus}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default TaskNode;
