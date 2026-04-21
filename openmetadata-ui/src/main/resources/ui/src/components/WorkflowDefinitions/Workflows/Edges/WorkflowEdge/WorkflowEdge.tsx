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
import { PlusOutlined } from '@ant-design/icons';
import { Button, Menu, Popover } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
} from 'reactflow';
import {
  WORKFLOW_EDGE_BTN_HEIGHT,
  WORKFLOW_EDGE_BTN_WIDTH,
} from '../../../../../constants/Workflow.constants';
import { useWorkflowStore } from '../../useWorkflowStore';
import './workflow-edge.less';

// Constants for button size
const [buttonWidth, buttonHeight] = [
  WORKFLOW_EDGE_BTN_WIDTH,
  WORKFLOW_EDGE_BTN_HEIGHT,
];

export const WorkflowEdge = (props: EdgeProps) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    label,
    markerEnd,
  } = props;
  const { t } = useTranslation();
  const { isEditMode } = useWorkflowStore();

  const menu = (
    <Menu>
      <Menu.Item key="task">{t('label.task')}</Menu.Item>
      <Menu.Item key="end">{t('label.end')}</Menu.Item>
      <Menu.Item key="condition">{t('label.condition')}</Menu.Item>
    </Menu>
  );

  // Get the smooth step path from the helper function
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeLabel = React.useMemo(() => {
    const commonStyle = {
      position: 'absolute',
      transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
      pointerEvents: 'all',
    };

    return isEditMode ? (
      <Popover content={menu} trigger="click">
        <Button
          icon={<PlusOutlined />}
          shape="circle"
          style={
            {
              ...commonStyle,
              width: buttonWidth,
              height: buttonHeight,
            } as React.CSSProperties
          }
        />
      </Popover>
    ) : label ? (
      <div
        className="workflow-edge-label"
        style={commonStyle as React.CSSProperties}>
        {label}
      </div>
    ) : null;
  }, [isEditMode, label, labelX, labelY, menu]);

  return (
    <>
      {/* Use the path string */}
      <BaseEdge id={id} markerEnd={markerEnd} path={path} />
      <EdgeLabelRenderer>{edgeLabel}</EdgeLabelRenderer>
    </>
  );
};
