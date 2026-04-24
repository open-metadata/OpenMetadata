/*
 *  Copyright 2024 Collate.
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

import { Card, Typography } from '@openmetadata/ui-core-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ClickIcon } from '../../../assets/svg/ic_click.svg';
import { useWorkflowModeContext } from '../../../contexts/WorkflowModeContext';
import { EmptyCanvasMessageProps } from '../../../interface/workflow-builder-components.interface';

export const EmptyCanvasMessage: React.FC<EmptyCanvasMessageProps> = ({
  isDragging,
  hasNodes,
}) => {
  const { isViewMode, showWorkflowNodePalette } = useWorkflowModeContext();
  const { t } = useTranslation();

  if (isDragging || hasNodes || isViewMode || !showWorkflowNodePalette) {
    return null;
  }

  return (
    <div className="tw:absolute tw:top-1/2 tw:left-1/2 tw:-translate-x-1/2 tw:-translate-y-1/2 tw:pointer-events-none tw:z-1">
      <Card className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:px-6 tw:py-5">
        <ClickIcon />
        <Typography
          className="tw:m-0 tw:text-primary tw:text-center"
          size="text-sm">
          {t('label.drag-and-drop-the-nodes-here')}
        </Typography>
      </Card>
    </div>
  );
};
