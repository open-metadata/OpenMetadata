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

import { Badge } from '@openmetadata/ui-core-components';
import React from 'react';
import { formatEntityType } from '../taskList.utils';

/**
 * The kind of asset a composed task title names ("Test Case"), set after the
 * title as a badge rather than in brackets.
 */
const TaskTitleEntityBadge: React.FC<{ entityType?: string }> = ({
  entityType,
}) =>
  entityType ? (
    <Badge
      className="tw:ml-2 tw:align-middle"
      color="gray"
      data-testid="task-title-entity-type"
      size="sm"
      type="modern">
      {formatEntityType(entityType)}
    </Badge>
  ) : null;

export default TaskTitleEntityBadge;
