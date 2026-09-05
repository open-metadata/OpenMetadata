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

import { Box, Popover, Typography } from '@openmetadata/ui-core-components';
import { Check, ChevronUp } from '@untitledui/icons';
import classNames from 'classnames';
import React, { useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import appModeAIIcon from '../../assets/svg/app-mode-ai.svg';
import { ReactComponent as AppModeClassicIcon } from '../../assets/svg/app-mode-classic.svg';
import {
  AI_APP_MODE,
  DEFAULT_APP_MODE,
} from '../../constants/appMode.constants';
import { useCurrentUserPreferences } from '../../hooks/currentUserStore/useCurrentUserStore';
import {
  RUNTIME_TO_PREFERENCE_WIRE,
  useAppMode,
  useIsAiMode,
  writeAppMode,
} from '../../hooks/useAppMode';

const OPTION_ICON_BOX =
  'tw:w-9 tw:h-9 tw:rounded-[10px] tw:bg-blue-50 tw:border tw:border-blue-100 tw:shrink-0';

const BADGE_CLASS =
  'tw:inline-flex tw:items-center tw:gap-1 tw:px-2 tw:py-0.5 tw:rounded-full ' +
  'tw:bg-blue-50 tw:border tw:border-blue-200 tw:text-blue-700 tw:text-xs tw:font-semibold ' +
  'tw:whitespace-nowrap tw:shrink-0';

const AppModeSwitcherTrigger: React.FC<{
  compact?: boolean;
  isOpen: boolean;
  isAiMode: boolean;
  aiLabel: string;
  modeLabel: string;
  modeLabelSentence: string;
  triggerRef: React.RefObject<HTMLButtonElement>;
  onClick: () => void;
}> = ({
  compact,
  isOpen,
  isAiMode,
  aiLabel,
  modeLabel,
  modeLabelSentence,
  triggerRef,
  onClick,
}) => {
  const iconSize = compact ? 12 : 16;
  const modeLabelText = compact ? modeLabel : modeLabelSentence;

  return (
    <button
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      className={
        compact
          ? 'tw:flex tw:items-center tw:gap-1 tw:px-2 tw:py-1 tw:bg-utility-blue-50 tw:border tw:border-utility-blue-200 tw:rounded-full tw:cursor-pointer tw:text-left'
          : 'tw:flex tw:items-center tw:gap-1.5 tw:w-full tw:p-0 tw:bg-transparent tw:border-0 tw:cursor-pointer tw:text-left'
      }
      data-testid="app-mode-switcher-trigger"
      ref={triggerRef}
      type="button"
      onClick={onClick}>
      {isAiMode ? (
        <img
          alt={aiLabel}
          data-testid="app-mode-trigger-icon-ai"
          height={iconSize}
          src={appModeAIIcon}
          width={iconSize}
        />
      ) : (
        <AppModeClassicIcon
          data-testid="app-mode-trigger-icon-classic"
          height={iconSize}
          width={iconSize}
        />
      )}
      <span
        className={
          compact
            ? 'tw:text-[10px] tw:text-utility-blue-700 tw:font-semibold'
            : 'tw:flex-1 tw:text-xs tw:text-secondary tw:font-semibold'
        }>
        {modeLabelText}
      </span>
      <ChevronUp
        className={classNames(
          'tw:shrink-0 tw:transition-transform tw:duration-150',
          compact ? 'tw:text-utility-blue-500' : undefined,
          { 'tw:rotate-180': isOpen }
        )}
        height={compact ? 10 : 11}
        width={compact ? 10 : 11}
      />
    </button>
  );
};

const AppModeSwitcher: React.FC<{
  className?: string;
  cardRef?: React.RefObject<HTMLElement>;
  compact?: boolean;
  classicHref?: string;
  aiHref?: string;
}> = ({ className, cardRef, compact, classicHref = '/', aiHref = '/' }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const currentMode = useAppMode();
  const isAiMode = useIsAiMode();
  const { preferences, setPreference } = useCurrentUserPreferences();

  const modeLabel = isAiMode ? t('label.ai') : t('label.classic');

  const handleClassicClick = () => {
    writeAppMode(DEFAULT_APP_MODE);
    navigate(classicHref);
    setIsOpen(false);
  };

  const handleAIClick = () => {
    writeAppMode(AI_APP_MODE);
    navigate(aiHref);
    setIsOpen(false);
  };

  // Checkbox is the ONLY writer of the persistent app-mode preference.
  // Toggling on → write the current mode (translated to the preference's
  // wire token via RUNTIME_TO_PREFERENCE_WIRE, see useAppMode.ts); toggling
  // off → clear it. The active runtime mode is untouched — the preference
  // only affects the boot resolver on the next fresh tab / login.
  const currentModeWireToken =
    RUNTIME_TO_PREFERENCE_WIRE[currentMode] ?? currentMode;
  const isRemembered = preferences.appMode === currentModeWireToken;
  const handleRememberToggle = () => {
    setPreference({ appMode: isRemembered ? null : currentModeWireToken });
  };

  return (
    <div className={classNames(className)}>
      <AppModeSwitcherTrigger
        aiLabel={t('label.ai')}
        compact={compact}
        isAiMode={isAiMode}
        isOpen={isOpen}
        modeLabel={modeLabel}
        modeLabelSentence={t('label.mode-label', { mode: modeLabel })}
        triggerRef={triggerRef}
        onClick={() => setIsOpen((prev) => !prev)}
      />

      <Popover
        containerClassName="tw:w-60"
        isOpen={isOpen}
        placement={compact ? 'right' : 'top start'}
        shouldCloseOnInteractOutside={(element) =>
          !triggerRef.current?.contains(element) &&
          !cardRef?.current?.contains(element)
        }
        triggerRef={compact ? triggerRef : cardRef ?? triggerRef}
        onOpenChange={setIsOpen}>
        <Box
          className="tw:p-2"
          data-testid="app-mode-switcher-card"
          direction="col">
          <p className="tw:px-2.5 tw:pt-2 tw:pb-1.5 tw:m-0 tw:text-[11px] tw:font-bold tw:tracking-widest tw:uppercase tw:text-tertiary">
            {t('label.switch-interface')}
          </p>

          <button
            className={classNames(
              'tw:flex tw:items-center tw:gap-2.5 tw:w-full tw:p-2.5 tw:rounded-xl tw:cursor-pointer tw:transition tw:bg-white tw:border tw:text-left',
              {
                'tw:bg-blue-50 tw:border-blue-200': !isAiMode,
                'tw:border-transparent tw:hover:bg-blue-50': isAiMode,
              }
            )}
            data-testid="app-mode-option-classic"
            type="button"
            onClick={handleClassicClick}>
            <Box align="center" className={OPTION_ICON_BOX} justify="center">
              <AppModeClassicIcon height={23} width={23} />
            </Box>
            <Box className="tw:flex-1 tw:min-w-0" direction="col">
              <Typography
                className="tw:text-primary"
                size="text-sm"
                weight="semibold">
                {t('label.classic')}
              </Typography>
            </Box>
            {!isAiMode && (
              <span className={BADGE_CLASS} data-testid="classic-current-badge">
                <Check height={12} width={12} />
                {t('label.current')}
              </span>
            )}
          </button>

          <button
            className={classNames(
              'tw:flex tw:items-center tw:gap-2.5 tw:w-full tw:p-2.5 tw:mt-1.5 tw:rounded-xl tw:cursor-pointer tw:transition tw:bg-white tw:border tw:text-left',
              {
                'tw:bg-blue-50 tw:border-blue-200': isAiMode,
                'tw:border-transparent tw:hover:bg-blue-50': !isAiMode,
              }
            )}
            data-testid="app-mode-option-ai"
            type="button"
            onClick={handleAIClick}>
            <Box align="center" className={OPTION_ICON_BOX} justify="center">
              <img alt="" height={30} src={appModeAIIcon} width={30} />
            </Box>
            <Box className="tw:flex-1 tw:min-w-0" direction="col">
              <Typography
                className="tw:text-primary"
                size="text-sm"
                weight="semibold">
                {t('label.ai')}
              </Typography>
            </Box>
            {isAiMode && (
              <span className={BADGE_CLASS} data-testid="ai-current-badge">
                <Check height={12} width={12} />
                {t('label.current')}
              </span>
            )}
          </button>

          <hr className="tw:border-0 tw:border-t tw:border-gray-200 tw:my-2" />

          <button
            className="tw:flex tw:items-center tw:gap-2.5 tw:w-full tw:px-2 tw:py-2.5 tw:border-0 tw:bg-transparent tw:cursor-pointer tw:text-left"
            data-testid="app-mode-remember-toggle"
            type="button"
            onClick={handleRememberToggle}>
            <Box
              align="center"
              aria-checked={isRemembered}
              className={classNames(
                'tw:w-5 tw:h-5 tw:rounded-md tw:shrink-0 tw:transition',
                {
                  'tw:bg-blue-600 tw:border-0': isRemembered,
                  'tw:bg-white tw:border tw:border-gray-400': !isRemembered,
                }
              )}
              justify="center"
              role="checkbox">
              {isRemembered && (
                <Check className="tw:text-white" height={13} width={13} />
              )}
            </Box>
            <span className="tw:text-sm tw:font-medium tw:text-secondary">
              <Trans
                components={{ bold: <b /> }}
                i18nKey="label.open-in-mode-when-login"
                values={{ mode: modeLabel }}
              />
            </span>
          </button>
        </Box>
      </Popover>
    </div>
  );
};

export default AppModeSwitcher;
