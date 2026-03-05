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

import { Button, ButtonUtility } from '@openmetadata/ui-core-components';
import { RefreshCw01 } from '@untitledui/icons';
import { FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FitScreenIcon } from '../../assets/svg/ic-fit-screen.svg';
import { ReactComponent as FitViewOptionsIcon } from '../../assets/svg/ic-fit-view-options.svg';
import { ReactComponent as HomeIcon } from '../../assets/svg/ic-home.svg';
import { ReactComponent as MapIcon } from '../../assets/svg/ic-map.svg';
import { ReactComponent as RearrangeNodesIcon } from '../../assets/svg/ic-rearrange-nodes.svg';
import { ReactComponent as ZoomInIcon } from '../../assets/svg/ic-zoom-in.svg';
import { ReactComponent as ZoomOutIcon } from '../../assets/svg/ic-zoom-out.svg';

export interface OntologyControlButtonsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onRefresh: () => void;
  onRearrange?: () => void;
  onFocusSelected?: () => void;
  onFocusHome?: () => void;
  onToggleMinimap?: () => void;
  isMinimapVisible?: boolean;
  isLoading?: boolean;
}

const OntologyControlButtons: FC<OntologyControlButtonsProps> = ({
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onRefresh,
  onRearrange,
  onFocusSelected,
  onFocusHome,
  onToggleMinimap,
  isMinimapVisible = false,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);

  const handleFitView = useCallback(() => {
    onFitToScreen();
    setViewOptionsOpen(false);
  }, [onFitToScreen]);

  const handleRearrange = useCallback(() => {
    onRearrange?.();
    setViewOptionsOpen(false);
  }, [onRearrange]);

  const handleFocusSelected = useCallback(() => {
    onFocusSelected?.();
    setViewOptionsOpen(false);
  }, [onFocusSelected]);

  const handleFocusHome = useCallback(() => {
    onFocusHome?.();
    setViewOptionsOpen(false);
  }, [onFocusHome]);

  return (
    <div className="tw:flex tw:flex-shrink-0 tw:flex-wrap-nowrap tw:items-center tw:gap-1">
      <div className="tw:relative">
        <ButtonUtility
          color={viewOptionsOpen ? 'secondary' : 'tertiary'}
          data-testid="view-options"
          icon={FitViewOptionsIcon}
          size="sm"
          tooltip={t('label.view-option-plural')}
          onClick={() => setViewOptionsOpen((v) => !v)}
        />

        {viewOptionsOpen && (
          <>
            <button
              aria-label="Close view options"
              className="tw:fixed tw:inset-0 tw:z-[1040] tw:cursor-default tw:border-0 tw:bg-transparent tw:p-0"
              type="button"
              onClick={() => setViewOptionsOpen(false)}
            />
            <div className="tw:absolute tw:left-0 tw:top-full tw:z-[1041] tw:mt-1 tw:flex tw:flex-col tw:gap-1 tw:rounded-lg tw:bg-white tw:py-1 tw:shadow-lg tw:ring-1 tw:ring-gray-200">
              <Button
                color="tertiary"
                iconLeading={FitScreenIcon}
                size="sm"
                onClick={handleFitView}>
                {t('label.fit-to-screen')}
              </Button>
              {onFocusSelected && (
                <Button
                  color="tertiary"
                  iconLeading={FitViewOptionsIcon}
                  size="sm"
                  onClick={handleFocusSelected}>
                  {t('label.focus-selected')}
                </Button>
              )}
              {onRearrange && (
                <Button
                  color="tertiary"
                  iconLeading={RearrangeNodesIcon}
                  size="sm"
                  onClick={handleRearrange}>
                  {t('label.rearrange-nodes')}
                </Button>
              )}
              {onFocusHome && (
                <Button
                  color="tertiary"
                  iconLeading={HomeIcon}
                  size="sm"
                  onClick={handleFocusHome}>
                  {t('label.focus-home')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {onToggleMinimap && (
        <ButtonUtility
          color={isMinimapVisible ? 'secondary' : 'tertiary'}
          data-testid="toggle-minimap"
          icon={MapIcon}
          size="sm"
          tooltip={t('label.mind-map')}
          onClick={onToggleMinimap}
        />
      )}

      <ButtonUtility
        color="tertiary"
        data-testid="zoom-in"
        icon={ZoomInIcon}
        size="sm"
        tooltip={t('label.zoom-in')}
        onClick={onZoomIn}
      />

      <ButtonUtility
        color="tertiary"
        data-testid="zoom-out"
        icon={ZoomOutIcon}
        size="sm"
        tooltip={t('label.zoom-out')}
        onClick={onZoomOut}
      />

      <ButtonUtility
        color="tertiary"
        data-testid="refresh"
        icon={RefreshCw01}
        isDisabled={isLoading}
        size="sm"
        tooltip={t('label.refresh')}
        onClick={onRefresh}
      />
    </div>
  );
};

export default OntologyControlButtons;
