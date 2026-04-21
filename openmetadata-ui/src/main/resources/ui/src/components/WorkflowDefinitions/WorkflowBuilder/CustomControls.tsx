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
  Button,
  Card,
  Divider,
  Typography,
} from '@openmetadata/ui-core-components';
import { GitBranch01, Maximize01, Minus, Plus } from '@untitledui/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from 'reactflow';
import { ReactComponent as RedoIcon } from '../../../assets/svg/ic_redo.svg';
import { ReactComponent as UndoIcon } from '../../../assets/svg/ic_undo.svg';
import { CustomControlsProps } from '../../../interface/workflow-builder-components.interface';

export const CustomControls: React.FC<CustomControlsProps> = ({
  allowStructuralGraphEdits = true,
  canRedo = false,
  canUndo = false,
  isViewMode = false,
  onRearrange,
  onRedo,
  onUndo,
}) => {
  const { t } = useTranslation();
  const { fitView, getZoom, zoomIn, zoomOut } = useReactFlow();
  const [currentZoom, setCurrentZoom] = React.useState(75);

  React.useEffect(() => {
    const updateZoom = () => {
      const zoom = getZoom();
      setCurrentZoom(Math.round(zoom * 100));
    };
    updateZoom();
    const interval = setInterval(updateZoom, 100);

    return () => clearInterval(interval);
  }, [getZoom]);

  const handleRearrange = () => {
    if (onRearrange) {
      onRearrange();
    }
  };

  const handleZoomIn = () => {
    zoomIn();
  };

  const handleZoomOut = () => {
    zoomOut();
  };

  const handleFitView = () => {
    fitView({ padding: 0.2 });
  };

  return (
    <Card
      className="tw:absolute tw:bottom-5 tw:right-5 tw:flex tw:items-center tw:gap-0.5 tw:z-10 tw:p-1"
      data-testid="workflow-controls">
      <Button
        color="tertiary"
        data-testid="undo-button"
        iconLeading={UndoIcon}
        isDisabled={!canUndo || isViewMode}
        size="sm"
        onPress={onUndo}
      />
      <Button
        color="tertiary"
        data-testid="redo-button"
        iconLeading={RedoIcon}
        isDisabled={!canRedo || isViewMode}
        size="sm"
        onPress={onRedo}
      />

      <Divider orientation="vertical" />

      <Button
        color="tertiary"
        data-testid="zoom-out-button"
        iconLeading={Minus}
        size="sm"
        onPress={handleZoomOut}
      />
      <Typography
        className="tw:min-w-11 tw:text-center tw:text-secondary"
        size="text-xs"
        weight="medium">
        {currentZoom}
        {t('label.percentage-symbol')}
      </Typography>
      <Button
        color="tertiary"
        data-testid="zoom-in-button"
        iconLeading={Plus}
        size="sm"
        onPress={handleZoomIn}
      />

      <Divider orientation="vertical" />

      <Button
        color="tertiary"
        data-testid="fit-view-button"
        iconLeading={Maximize01}
        size="sm"
        onPress={handleFitView}
      />

      <Divider orientation="vertical" />

      <Button
        color="tertiary"
        data-testid="rearrange-button"
        iconLeading={GitBranch01}
        isDisabled={isViewMode || !allowStructuralGraphEdits}
        size="sm"
        onPress={
          isViewMode || !allowStructuralGraphEdits ? undefined : handleRearrange
        }
      />
    </Card>
  );
};
