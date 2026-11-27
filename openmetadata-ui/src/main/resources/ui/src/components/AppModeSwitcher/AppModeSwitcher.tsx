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

import {
  Badge,
  Box,
  Card,
  HoverCard,
  Popover,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Check,
  ChevronRight,
  ChevronUp,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { FC, useRef, useState } from 'react';
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
import {
  CURRENT_CHECK_CLASS,
  OPTION_ICON_BOX,
  TRIGGER_STYLES,
} from './AppModeSwitcher.constants';
import {
  AppModeSwitcherProps,
  AppModeSwitcherTriggerProps,
} from './AppModeSwitcher.types';
import { ClassicDeprecationCard } from './ClassicDeprecationNotice';

const AppModeSwitcherTrigger: FC<AppModeSwitcherTriggerProps> = ({
  variant,
  isOpen,
  isAiMode,
  aiLabel,
  modeLabel,
  modeLabelSentence,
  triggerRef,
  onClick,
}) => {
  const { root, label, iconSize, chevron } = TRIGGER_STYLES[variant];

  return (
    <button
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      aria-label={label ? undefined : modeLabelSentence}
      className={root}
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
      {label && (
        <span className={label}>
          {variant === 'pill' ? modeLabel : modeLabelSentence}
        </span>
      )}
      {chevron === 'up' && (
        <ChevronUp
          className={classNames(
            'tw:shrink-0 tw:text-utility-blue-500 tw:transition-transform tw:duration-150',
            { 'tw:rotate-180': isOpen }
          )}
          height={10}
          width={10}
        />
      )}
      {chevron === 'right' && (
        <ChevronRight
          className="tw:shrink-0 tw:text-tertiary"
          height={16}
          width={16}
        />
      )}
    </button>
  );
};

const AppModeSwitcher: FC<AppModeSwitcherProps> = ({
  className,
  cardRef,
  classicHref = '/',
  aiHref = '/',
  variant = 'inline',
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const currentMode = useAppMode();
  const isAiMode = useIsAiMode();
  const { preferences, setPreference } = useCurrentUserPreferences();

  const modeLabel = isAiMode ? t('label.ai') : t('label.classic');
  const isPill = variant === 'pill';
  const { frame } = TRIGGER_STYLES[variant];

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

  const trigger = (
    <AppModeSwitcherTrigger
      aiLabel={t('label.ai')}
      isAiMode={isAiMode}
      isOpen={isOpen}
      modeLabel={modeLabel}
      modeLabelSentence={t('label.mode-label', { mode: modeLabel })}
      triggerRef={triggerRef}
      variant={variant}
      onClick={() => setIsOpen((prev) => !prev)}
    />
  );

  return (
    <div className={classNames(className)}>
      {frame ? <Card className={frame}>{trigger}</Card> : trigger}

      <Popover
        aria-label={t('label.switch-interface')}
        containerClassName="tw:w-64"
        isOpen={isOpen}
        placement={isPill ? 'right' : 'right bottom'}
        shouldCloseOnInteractOutside={(element) =>
          !triggerRef.current?.contains(element) &&
          !cardRef?.current?.contains(element)
        }
        triggerRef={isPill ? triggerRef : cardRef ?? triggerRef}
        onOpenChange={setIsOpen}>
        <Box
          className="tw:p-2"
          data-testid="app-mode-switcher-card"
          direction="col">
          <p className="tw:px-2.5 tw:pt-2 tw:pb-1.5 tw:m-0 tw:text-[11px] tw:font-bold tw:tracking-widest tw:uppercase tw:text-tertiary">
            {t('label.switch-interface')}
          </p>

          <HoverCard
            arrow
            content={<ClassicDeprecationCard />}
            offset={28}
            placement="right">
            <button
              className={classNames(
                'tw:flex tw:items-center tw:gap-2.5 tw:w-full tw:p-2.5 tw:rounded-xl tw:cursor-pointer tw:transition tw:bg-surface tw:border tw:text-left',
                {
                  'tw:bg-utility-blue-50 tw:border-utility-blue-200': !isAiMode,
                  'tw:border-transparent tw:hover:bg-utility-blue-50': isAiMode,
                }
              )}
              data-testid="app-mode-option-classic"
              type="button"
              onClick={handleClassicClick}>
              <Box align="center" className={OPTION_ICON_BOX} justify="center">
                <AppModeClassicIcon height={23} width={23} />
              </Box>
              <Box align="center" className="tw:flex-1 tw:min-w-0" gap={2}>
                <Typography
                  className="tw:text-primary"
                  size="text-sm"
                  weight="semibold">
                  {t('label.classic')}
                </Typography>
                <Badge
                  color="warning"
                  data-testid="classic-deprecated-badge"
                  size="sm">
                  {t('label.deprecated')}
                </Badge>
              </Box>
              {!isAiMode && (
                <Check
                  aria-hidden={false}
                  aria-label={t('label.current')}
                  className={CURRENT_CHECK_CLASS}
                  data-testid="classic-current-badge"
                  role="img"
                  size={16}
                />
              )}
            </button>
          </HoverCard>

          <button
            className={classNames(
              'tw:flex tw:items-center tw:gap-2.5 tw:w-full tw:p-2.5 tw:mt-1.5 tw:rounded-xl tw:cursor-pointer tw:transition tw:bg-surface tw:border tw:text-left',
              {
                'tw:bg-utility-blue-50 tw:border-utility-blue-200': isAiMode,
                'tw:border-transparent tw:hover:bg-utility-blue-50': !isAiMode,
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
              <Check
                aria-hidden={false}
                aria-label={t('label.current')}
                className={CURRENT_CHECK_CLASS}
                data-testid="ai-current-badge"
                role="img"
                size={16}
              />
            )}
          </button>

          <hr className="tw:border-0 tw:border-t tw:border-secondary tw:my-2" />

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
                  'tw:bg-brand-solid tw:border-0': isRemembered,
                  'tw:bg-surface tw:border tw:border-utility-gray-400':
                    !isRemembered,
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
