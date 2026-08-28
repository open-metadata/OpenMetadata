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

import {
  Badge,
  Card,
  Divider,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddIcon } from '../../../assets/svg/ic_add.svg';
import { NODE_TYPE_MAPPINGS } from '../../../constants/WorkflowBuilder.constants';
import { NodeSubType } from '../../../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../../../generated/governance/workflows/elements/nodeType';
import { TaskItemProps } from '../../../interface/workflow-builder-components.interface';
import { getNodeIcon } from '../../../utils/NodeIconUtils';

const TaskItem = ({
  disabled = false,
  icon,
  isBeta = false,
  label,
  type,
  onDragStart,
}: TaskItemProps) => {
  const { t } = useTranslation();

  const handleDragStart = (event: React.DragEvent) => {
    if (disabled) {
      event.preventDefault();

      return;
    }
    onDragStart(event, type, label);
  };

  const itemClassName = classNames(
    'tw:flex tw:p-2 tw:mb-3 tw:cursor-pointer tw:items-center',
    {
      'tw:cursor-grab tw:hover:shadow-sm': !disabled,
      'tw:cursor-not-allowed tw:opacity-60': disabled,
    }
  );

  return (
    <Card
      className={itemClassName}
      data-testid={`workflow-task-item-${type}`}
      draggable={!disabled}
      onDragStart={handleDragStart}>
      <Typography as="span" className="tw:mr-2 tw:flex tw:items-center">
        {icon}
      </Typography>
      <div className="tw:flex-1 tw:min-w-0">
        <Typography
          ellipsis
          as="p"
          className="tw:m-0 tw:text-primary"
          size="text-sm"
          weight="regular">
          {label}
        </Typography>
      </div>
      {isBeta && (
        <Badge className="tw:mr-2" color="brand" type="pill-color">
          {t('label.beta')}
        </Badge>
      )}
      <AddIcon />
    </Card>
  );
};

interface WorkflowSidebarProps {
  isNodeDragEnabled?: (nodeType: string) => boolean;
}

const WorkflowSidebar = ({ isNodeDragEnabled }: WorkflowSidebarProps) => {
  const { t } = useTranslation();

  const onDragStart = (
    event: React.DragEvent,
    subType: NodeSubType,
    label: string
  ) => {
    const mapping =
      NODE_TYPE_MAPPINGS[subType as keyof typeof NODE_TYPE_MAPPINGS];
    const customNodeType = mapping?.type || NodeType.AutomatedTask;

    event.dataTransfer.setData('application/reactflow', customNodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const automatedTasks = Object.entries(NODE_TYPE_MAPPINGS)
    .filter(
      ([, mapping]) =>
        mapping.type === NodeType.AutomatedTask &&
        !('category' in mapping && mapping.category === 'sink')
    )
    .map(([subType, mapping]) => ({
      icon: getNodeIcon(subType as NodeSubType, {
        style: { width: '16px', height: '16px' },
      }),
      label: mapping.label,
      type: subType as NodeSubType,
    }));

  const sinkTasks = Object.entries(NODE_TYPE_MAPPINGS)
    .filter(
      ([, mapping]) => 'category' in mapping && mapping.category === 'sink'
    )
    .map(([subType, mapping]) => ({
      icon: getNodeIcon(subType as NodeSubType, {
        style: { width: '16px', height: '16px' },
      }),
      isBeta: subType === NodeSubType.SinkTask,
      label: mapping.label,
      type: subType as NodeSubType,
    }));

  const userTasks = Object.entries(NODE_TYPE_MAPPINGS)
    .filter(([, mapping]) => mapping.type === NodeType.UserTask)
    .map(([subType, mapping]) => ({
      icon: getNodeIcon(subType as NodeSubType, {
        style: { width: '16px', height: '16px' },
      }),
      label: mapping.label,
      type: subType as NodeSubType,
    }));

  const isStartDisabled = isNodeDragEnabled
    ? !isNodeDragEnabled(NodeType.StartEvent)
    : false;
  const isEndDisabled = isNodeDragEnabled
    ? !isNodeDragEnabled(NodeType.EndEvent)
    : false;

  const startNodeClassName = classNames(
    'tw:w-28 tw:h-15 tw:flex tw:flex-col tw:items-center tw:justify-center tw:transition-all tw:duration-200 tw:relative',
    {
      'tw:cursor-grab tw:hover:shadow-sm': !isStartDisabled,
      'tw:cursor-not-allowed tw:opacity-60': isStartDisabled,
    }
  );

  const endNodeClassName = classNames(
    'tw:w-28 tw:h-15 tw:flex tw:flex-col tw:items-center tw:justify-center tw:transition-all tw:duration-200 tw:relative',
    {
      'tw:cursor-grab tw:hover:shadow-sm': !isEndDisabled,
      'tw:cursor-not-allowed tw:opacity-60': isEndDisabled,
    }
  );

  return (
    <div data-testid="workflow-node-sidebar">
      <Typography
        as="p"
        className="tw:m-0 tw:text-primary tw:px-4.5 tw:py-2.5"
        size="text-xs"
        weight="semibold">
        {t('label.drag-and-drop-nodes')}
      </Typography>

      <Divider orientation="horizontal" />

      <div className="tw:flex tw:justify-between tw:py-4 tw:px-5">
        <Card
          className={startNodeClassName}
          data-testid="workflow-start-node-draggable"
          draggable={!isStartDisabled}
          onDragStart={(e) => {
            if (isStartDisabled) {
              e.preventDefault();

              return;
            }
            onDragStart(e, NodeSubType.StartEvent, 'Start');
          }}>
          {getNodeIcon(NodeSubType.StartEvent, {
            style: { width: '16px', height: '16px' },
          })}
          <Typography
            as="p"
            className="tw:m-0 tw:mt-1 tw:text-primary"
            size="text-xs"
            weight="regular">
            {t('label.start')}
          </Typography>
        </Card>

        <Card
          className={endNodeClassName}
          data-testid="workflow-end-node-draggable"
          draggable={!isEndDisabled}
          onDragStart={(e) => {
            if (isEndDisabled) {
              e.preventDefault();

              return;
            }
            onDragStart(e, NodeSubType.EndEvent, 'End');
          }}>
          {getNodeIcon(NodeSubType.EndEvent, {
            style: { width: '16px', height: '16px' },
          })}
          <Typography
            as="p"
            className="tw:m-0 tw:mt-1 tw:text-primary"
            size="text-xs"
            weight="regular">
            {t('label.end')}
          </Typography>
        </Card>
      </div>

      <Typography
        as="p"
        className="tw:m-0 tw:mt-2 tw:mb-4 tw:px-3.5 tw:text-secondary tw:tracking-wide tw:uppercase"
        size="text-xs"
        weight="semibold">
        {t('label.automated-tasks')}
      </Typography>
      <div
        className="tw:mb-6 tw:px-3.5"
        data-testid="workflow-automated-tasks-section">
        {automatedTasks.map((task) => (
          <TaskItem
            disabled={isNodeDragEnabled ? !isNodeDragEnabled(task.type) : false}
            icon={task.icon}
            key={task.type}
            label={task.label}
            type={task.type}
            onDragStart={onDragStart}
          />
        ))}
      </div>

      <Typography
        as="p"
        className="tw:m-0 tw:mt-2 tw:mb-4 tw:px-3.5 tw:text-secondary tw:tracking-wide tw:uppercase"
        size="text-xs"
        weight="semibold">
        {t('message.sinks')}
      </Typography>
      <div className="tw:mb-6 tw:px-3.5" data-testid="workflow-sinks-section">
        {sinkTasks.map((task) => (
          <TaskItem
            disabled={isNodeDragEnabled ? !isNodeDragEnabled(task.type) : false}
            icon={task.icon}
            isBeta={task.isBeta}
            key={task.type}
            label={task.label}
            type={task.type}
            onDragStart={onDragStart}
          />
        ))}
      </div>

      <Typography
        as="p"
        className="tw:m-0 tw:mt-2 tw:mb-4 tw:px-3.5 tw:text-secondary tw:tracking-wide tw:uppercase"
        size="text-xs"
        weight="semibold">
        {t('label.user-tasks')}
      </Typography>
      <div className="tw:px-3.5" data-testid="workflow-user-tasks-section">
        {userTasks.map((task) => (
          <TaskItem
            disabled={isNodeDragEnabled ? !isNodeDragEnabled(task.type) : false}
            icon={task.icon}
            key={task.type}
            label={task.label}
            type={task.type}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </div>
  );
};

export default WorkflowSidebar;
