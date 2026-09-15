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

import { Check } from '@untitledui/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import appModeAIIcon from '../../assets/svg/app-mode-ai.svg';
import { ReactComponent as AppModeClassicIcon } from '../../assets/svg/app-mode-classic.svg';
import {
  AI_APP_MODE,
  DEFAULT_APP_MODE,
} from '../../constants/appMode.constants';
import { useIsAiMode, writeAppMode } from '../../hooks/useAppMode';

const OPTION_CLASS =
  'tw:flex tw:items-center tw:gap-2 tw:w-full tw:px-2 tw:py-1.5 tw:rounded-md ' +
  'tw:border-0 tw:bg-transparent tw:cursor-pointer tw:text-left tw:font-medium ' +
  'tw:text-secondary tw:hover:bg-blue-50';

/**
 * Inline Classic⇄AI interface switch for the classic navbar profile dropdown.
 * AI is always available in OSS (the app-mode shell ships in-tree, no
 * install-gate — see SettingsAppModePage), so this renders unconditionally.
 * Switching writes the app mode and navigates home; the boot resolver takes
 * the user into the selected experience.
 */
const InterfaceModeMenuItem = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAiMode = useIsAiMode();

  const handleClassic = () => {
    writeAppMode(DEFAULT_APP_MODE);
    navigate('/');
  };

  const handleAi = () => {
    writeAppMode(AI_APP_MODE);
    navigate('/');
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-1">
      <span className="tw:font-medium tw:text-primary">
        {t('label.user-interface')}
      </span>

      <button
        className={classNames(OPTION_CLASS, {
          'tw:text-utility-blue-700': !isAiMode,
        })}
        data-testid="interface-mode-option-classic"
        type="button"
        onClick={handleClassic}>
        <AppModeClassicIcon height={18} width={18} />
        <span className="tw:flex-1 tw:text-left">{t('label.classic')}</span>
        {!isAiMode && <Check height={16} width={16} />}
      </button>

      <button
        className={classNames(OPTION_CLASS, {
          'tw:text-utility-blue-700': isAiMode,
        })}
        data-testid="interface-mode-option-ai"
        type="button"
        onClick={handleAi}>
        <img alt="" height={20} src={appModeAIIcon} width={20} />
        <span className="tw:flex-1 tw:text-left">{t('label.ai')}</span>
        {isAiMode && <Check height={16} width={16} />}
      </button>
    </div>
  );
};

export default InterfaceModeMenuItem;
