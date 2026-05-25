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

import {
  Button,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import { RefreshCw01 } from '@untitledui/icons';
import { FC, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FitViewOptionsIcon } from '../../assets/svg/ic-fit-view-options.svg';
import { ReactComponent as ZoomInIcon } from '../../assets/svg/ic-zoom-in.svg';
import { ReactComponent as ZoomOutIcon } from '../../assets/svg/ic-zoom-out.svg';
import { OntologyControlButtonsProps } from './OntologyExplorer.interface';

const OntologyControlButtons: FC<OntologyControlButtonsProps> = ({
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onRefresh,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  const handleFitView = useCallback(() => {
    onFitToScreen();
  }, [onFitToScreen]);

  return (
    <div className="tw:flex tw:shrink-0 tw:flex-wrap-nowrap tw:items-center tw:gap-1">
      <TooltipTrigger>
        <Tooltip placement="top" title={t('label.fit-to-screen')}>
          <Button
            color="tertiary"
            data-testid="fit-view"
            iconLeading={<FitViewOptionsIcon height={20} width={20} />}
            size="sm"
            onClick={handleFitView}
          />
        </Tooltip>
      </TooltipTrigger>
      <div className="tw:h-6 tw:w-px tw:bg-gray-200" />

      <TooltipTrigger>
        <Tooltip placement="top" title={t('label.zoom-in')}>
          <Button
            color="tertiary"
            data-testid="zoom-in"
            iconLeading={<ZoomInIcon height={20} width={20} />}
            size="sm"
            onClick={onZoomIn}
          />
        </Tooltip>
      </TooltipTrigger>
      <div className="tw:h-6 tw:w-px tw:bg-gray-200" />
      <TooltipTrigger>
        <Tooltip placement="top" title={t('label.zoom-out')}>
          <Button
            color="tertiary"
            data-testid="zoom-out"
            iconLeading={<ZoomOutIcon height={20} width={20} />}
            size="sm"
            onClick={onZoomOut}
          />
        </Tooltip>
      </TooltipTrigger>
      <div className="tw:h-6 tw:w-px tw:bg-gray-200" />

      <TooltipTrigger>
        <Tooltip placement="top" title={t('label.refresh')}>
          <Button
            color="tertiary"
            data-testid="refresh"
            iconLeading={<RefreshCw01 height={20} width={20} />}
            isDisabled={isLoading}
            size="sm"
            onClick={onRefresh}
          />
        </Tooltip>
      </TooltipTrigger>
    </div>
  );
};

export default OntologyControlButtons;
