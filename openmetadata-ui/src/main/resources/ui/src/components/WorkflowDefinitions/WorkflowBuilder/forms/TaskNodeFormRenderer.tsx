/*
 *  Copyright 2025 Collate.
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

import React from 'react';
import { Node } from 'reactflow';
import { EntityType } from '../../../../enums/entity.enum';
import { NodeSubType } from '../../../../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../../../../generated/governance/workflows/elements/nodeType';
import { CheckChangeDescriptionForm } from './CheckChangeDescriptionForm';
import { CheckConditionForm } from './CheckConditionForm';
import { DataCompletenessForm } from './DataCompletenessForm';
import { EndNodeForm } from './EndNodeForm';
import { RevertBackForm } from './RevertBackForm';
import { SetActionForm } from './SetActionForm';
import { SinkTaskForm } from './SinkTaskForm';
import { UserApprovalForm } from './UserApprovalForm';

interface TaskNodeFormRendererProps {
  node: Node;
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
  entityTypes?: EntityType[];
}

export const TaskNodeFormRenderer: React.FC<TaskNodeFormRendererProps> = ({
  node,
  onSave,
  onClose,
  onDelete,
  entityTypes,
}) => {
  if (
    node.type === NodeType.EndEvent ||
    node.data?.subType === NodeSubType.EndEvent
  ) {
    return (
      <EndNodeForm
        node={node}
        onClose={onClose}
        onDelete={onDelete}
        onSave={onSave}
      />
    );
  }

  const nodeSubType: NodeSubType =
    node.data?.subType || node.data?.nodeSubType || '';

  switch (nodeSubType) {
    case NodeSubType.SetEntityAttributeTask:
      return (
        <SetActionForm
          entityTypes={entityTypes}
          node={node}
          onClose={onClose}
          onDelete={onDelete}
          onSave={onSave}
        />
      );

    case NodeSubType.CheckEntityAttributesTask:
      return (
        <CheckConditionForm
          entityTypes={entityTypes || [EntityType.ALL]}
          node={node}
          onClose={onClose}
          onDelete={onDelete}
          onSave={onSave}
        />
      );

    case NodeSubType.CheckChangeDescriptionTask:
      return (
        <CheckChangeDescriptionForm
          node={node}
          onClose={onClose}
          onDelete={onDelete}
          onSave={onSave}
        />
      );

    case NodeSubType.DataCompletenessTask:
      return (
        <DataCompletenessForm
          entityTypes={entityTypes}
          node={node}
          onClose={onClose}
          onDelete={onDelete}
          onSave={onSave}
        />
      );

    case NodeSubType.UserApprovalTask:
      return (
        <UserApprovalForm
          node={node}
          onClose={onClose}
          onDelete={onDelete}
          onSave={onSave}
        />
      );

    case NodeSubType.RollbackEntityTask:
      return (
        <RevertBackForm
          node={node}
          onClose={onClose}
          onDelete={onDelete}
          onSave={onSave}
        />
      );

    case NodeSubType.SinkTask:
      return (
        <SinkTaskForm
          node={node}
          onClose={onClose}
          onDelete={onDelete}
          onSave={onSave}
        />
      );

    default:
      return null;
  }
};
