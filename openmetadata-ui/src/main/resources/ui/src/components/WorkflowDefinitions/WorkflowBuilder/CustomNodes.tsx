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

import { Card, Divider, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, NodeProps, Position } from 'reactflow';
import { NodeSubType } from '../../../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../../../generated/governance/workflows/elements/nodeType';
import { CustomNodeData } from '../../../interface/WorkflowBuilder.interface';
import { getCanvasNodeIcon } from '../../../utils/NodeIconUtils';
import { getDisplayLabelFromSubType } from '../../../utils/NodeUtils';

const HANDLE_CLASS_NAME =
  'tw:!w-2.5 tw:!h-2.5 tw:!border-2 tw:!border-brand-solid tw:!bg-primary';

export const StartNode: React.FC<NodeProps<CustomNodeData>> = () => {
  const { t } = useTranslation();

  return (
    <Card
      className="tw:flex tw:items-center tw:rounded-full tw:relative tw:overflow-visible"
      data-testid="workflow-start-node">
      <div className="tw:flex tw:items-center tw:justify-center tw:p-1.5">
        {getCanvasNodeIcon(NodeSubType.StartEvent, {
          style: { width: '32px', height: '32px' },
        })}
      </div>
      <div className="tw:pl-1.5 tw:pr-5.5">
        <Typography
          className="tw:m-0 tw:text-primary"
          size="text-lg"
          weight="medium">
          {t('label.start')}
        </Typography>
      </div>

      <Handle
        className={HANDLE_CLASS_NAME}
        position={Position.Right}
        style={{
          right: -12,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
        type="source"
      />
    </Card>
  );
};

export const EndNode: React.FC<NodeProps<CustomNodeData>> = () => {
  const { t } = useTranslation();

  return (
    <Card
      className="tw:flex tw:items-center tw:rounded-full tw:relative tw:overflow-visible"
      data-testid="workflow-end-node">
      <Handle
        className={HANDLE_CLASS_NAME}
        position={Position.Left}
        style={{
          left: -12,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
        type="target"
      />

      <div className="tw:flex tw:items-center tw:justify-center tw:p-1.5">
        {getCanvasNodeIcon(NodeSubType.EndEvent, {
          style: { width: '32px', height: '32px' },
        })}
      </div>
      <div className="tw:pl-1.5 tw:pr-5.5">
        <Typography
          className="tw:m-0 tw:text-primary"
          size="text-lg"
          weight="medium">
          {t('label.end')}
        </Typography>
      </div>
    </Card>
  );
};

export const AutomatedTaskNode: React.FC<NodeProps<CustomNodeData>> = ({
  data,
  selected,
}) => {
  const nodeClassName = classNames(
    'tw:min-w-66 tw:relative tw:overflow-visible tw:transition-all tw:duration-200 tw:hover:ring-2 tw:hover:ring-brand-solid',
    { 'tw:ring-2 tw:ring-brand-solid': selected }
  );

  return (
    <Card
      className={nodeClassName}
      data-testid={`workflow-${data?.subType
        ?.toLowerCase()
        .replace(/([A-Z])/g, '-$1')
        .replace(/^-/, '')}-node`}>
      <Handle
        className={HANDLE_CLASS_NAME}
        position={Position.Left}
        style={{
          left: -12,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
        type="target"
      />

      <div className="tw:p-3 tw:rounded-lg tw:flex tw:items-center tw:gap-2">
        <div className="tw:w-4 tw:h-4 tw:bg-primary tw:rounded-sm tw:flex tw:items-center tw:justify-center">
          {getCanvasNodeIcon(data.subType, {
            style: { width: '16px', height: '16px' },
          })}
        </div>
        <Typography
          className="tw:m-0 tw:text-sm tw:font-medium tw:text-primary"
          size="text-sm"
          weight="medium">
          {getDisplayLabelFromSubType(data.subType)}
        </Typography>
      </div>
      <Divider orientation="horizontal" />
      <div className="tw:py-3.5 tw:px-3">
        <Typography
          className="tw:m-0 tw:text-xs tw:font-medium tw:text-primary"
          size="text-xs"
          weight="medium">
          {data.displayName || data.label}
        </Typography>
      </div>
      <Handle
        className={HANDLE_CLASS_NAME}
        position={Position.Right}
        style={{
          right: -12,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
        type="source"
      />
    </Card>
  );
};

export const UserTaskNode: React.FC<NodeProps<CustomNodeData>> = ({
  data,
  selected,
}) => {
  const nodeClassName = classNames(
    'tw:min-w-66 tw:relative tw:overflow-visible tw:transition-all tw:duration-200 tw:hover:ring-2 tw:hover:ring-brand-solid',
    { 'tw:ring-2 tw:ring-brand-solid': selected }
  );

  return (
    <Card
      className={nodeClassName}
      data-testid={`workflow-${data?.subType
        ?.toLowerCase()
        .replace(/([A-Z])/g, '-$1')
        .replace(/^-/, '')}-node`}>
      <Handle
        className={HANDLE_CLASS_NAME}
        position={Position.Left}
        style={{
          left: -12,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
        type="target"
      />
      <div className="tw:px-4 tw:py-3 tw:rounded-lg tw:flex tw:items-center tw:gap-2">
        <div className="tw:w-4 tw:h-4 tw:bg-primary tw:rounded-sm tw:flex tw:items-center tw:justify-center">
          {getCanvasNodeIcon(data.subType, {
            style: { width: '16px', height: '16px' },
          })}
        </div>
        <Typography
          className="tw:m-0  tw:text-primary"
          size="text-sm"
          weight="medium">
          {getDisplayLabelFromSubType(data.subType)}
        </Typography>
      </div>

      <Divider orientation="horizontal" />
      <div className="tw:py-3.5 tw:px-3">
        <Typography
          className="tw:m-0 tw:text-xs tw:font-medium tw:text-primary"
          size="text-xs"
          weight="medium">
          {data.displayName || data.label}
        </Typography>
      </div>
      <Handle
        className={HANDLE_CLASS_NAME}
        position={Position.Right}
        style={{
          right: -12,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
        type="source"
      />
    </Card>
  );
};

export const nodeTypes = {
  [NodeType.StartEvent]: StartNode,
  [NodeType.EndEvent]: EndNode,
  [NodeType.AutomatedTask]: AutomatedTaskNode,
  [NodeType.UserTask]: UserTaskNode,
};
