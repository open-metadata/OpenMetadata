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

import { ButtonUtility } from '@openmetadata/ui-core-components';
import {
  Maximize01,
  RefreshCw01,
  ZoomIn,
  ZoomOut,
} from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsAiMode } from '../../hooks/useAppMode';
import { OntologyControlButtonsProps } from './OntologyExplorer.interface';

// The design's 14px glyph; an element icon keeps ButtonUtility from resizing it.
const AI_ICON_CLASS_NAME = 'tw:size-3.5';
const AI_CELL_CLASS_NAME =
  'tw:flex tw:items-center tw:px-0.5 tw:not-first:border-l tw:not-first:border-secondary';

const OntologyControlButtons: FC<OntologyControlButtonsProps> = ({
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onRefresh,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();

  if (isAiMode) {
    return (
      <div className="tw:flex tw:shrink-0 tw:items-stretch">
        <div className={AI_CELL_CLASS_NAME}>
          <ButtonUtility
            color="tertiary"
            data-testid="fit-view"
            icon={<Maximize01 className={AI_ICON_CLASS_NAME} />}
            size="lg"
            tooltip={t('label.fit-to-screen')}
            onClick={onFitToScreen}
          />
        </div>
        <div className={AI_CELL_CLASS_NAME}>
          <ButtonUtility
            color="tertiary"
            data-testid="zoom-in"
            icon={<ZoomIn className={AI_ICON_CLASS_NAME} />}
            size="lg"
            tooltip={t('label.zoom-in')}
            onClick={onZoomIn}
          />
        </div>
        <div className={AI_CELL_CLASS_NAME}>
          <ButtonUtility
            color="tertiary"
            data-testid="zoom-out"
            icon={<ZoomOut className={AI_ICON_CLASS_NAME} />}
            size="lg"
            tooltip={t('label.zoom-out')}
            onClick={onZoomOut}
          />
        </div>
        <div className={AI_CELL_CLASS_NAME}>
          <ButtonUtility
            color="tertiary"
            data-testid="refresh"
            icon={<RefreshCw01 className={AI_ICON_CLASS_NAME} />}
            isDisabled={isLoading}
            size="lg"
            tooltip={t('label.refresh')}
            onClick={onRefresh}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="tw:flex tw:shrink-0 tw:flex-wrap-nowrap tw:items-center tw:gap-1">
      <ButtonUtility
        data-testid="fit-view"
        icon={Maximize01}
        size="lg"
        tooltip={t('label.fit-to-screen')}
        onClick={onFitToScreen}
      />
      <div className="tw:h-6 tw:w-px tw:bg-quaternary" />

      <ButtonUtility
        data-testid="zoom-in"
        icon={ZoomIn}
        size="lg"
        tooltip={t('label.zoom-in')}
        onClick={onZoomIn}
      />
      <div className="tw:h-6 tw:w-px tw:bg-quaternary" />
      <ButtonUtility
        data-testid="zoom-out"
        icon={ZoomOut}
        size="lg"
        tooltip={t('label.zoom-out')}
        onClick={onZoomOut}
      />
      <div className="tw:h-6 tw:w-px tw:bg-quaternary" />

      <ButtonUtility
        data-testid="refresh"
        icon={RefreshCw01}
        isDisabled={isLoading}
        size="lg"
        tooltip={t('label.refresh')}
        onClick={onRefresh}
      />
    </div>
  );
};

export default OntologyControlButtons;
