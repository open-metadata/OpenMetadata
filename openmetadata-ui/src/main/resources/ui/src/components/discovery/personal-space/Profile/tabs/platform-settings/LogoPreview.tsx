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

import { Image01, Loading01 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Theme } from '../../../../../../context/UntitledUIThemeProvider/theme-provider.interface';
import brandClassBase from '../../../../../../utils/BrandData/BrandClassBase';
import BrandImage from '../../../../../common/BrandImage/BrandImage';
import type { ImageStatus } from './useImageCheck';

interface LogoPreviewProps {
  url?: string;
  isMonogram: boolean;
  theme: Theme;
  testId: string;
  status?: ImageStatus;
}

/**
 * A logo on a fixed light or dark tile, whatever the active theme, so admins
 * see how it renders in both. `dark-mode` scopes the dark tokens to the tile.
 * An empty URL previews the default brand logo, which is what the app shows.
 */
const LogoPreview = ({
  url,
  isMonogram,
  theme,
  testId,
  status = 'idle',
}: LogoPreviewProps) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const isBroken = status === 'error' || status === 'invalid';
  const defaultSrc = isMonogram
    ? brandClassBase.getMonogram().src
    : brandClassBase.getLogo().src;

  const renderContent = () => {
    if (isBroken) {
      return (
        <Image01
          aria-hidden={false}
          aria-label={t(
            isDark
              ? 'label.no-dark-mode-preview'
              : 'label.no-light-mode-preview'
          )}
          className="tw:text-fg-quaternary"
          data-testid={testId}
          role="img"
          size={16}
        />
      );
    }
    if (status === 'loading') {
      return (
        <Loading01
          aria-hidden={false}
          aria-label={t('message.checking-image')}
          className="tw:animate-spin tw:text-fg-brand-primary"
          data-testid={testId}
          role="img"
          size={16}
        />
      );
    }

    return (
      <BrandImage
        alt={t(isDark ? 'label.dark-mode-preview' : 'label.light-mode-preview')}
        className="tw:max-h-full tw:max-w-full tw:object-contain"
        dataTestId={testId}
        height={isMonogram ? 24 : 28}
        isMonoGram={isMonogram}
        src={url || defaultSrc}
        width={isMonogram ? 24 : 116}
      />
    );
  };

  return (
    <div
      className={classNames(
        'tw:flex tw:h-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:p-1.5',
        isMonogram ? 'tw:w-10' : 'tw:w-33',
        isBroken ? 'tw:border-dashed' : 'tw:border-solid',
        isDark
          ? 'dark-mode tw:border-primary tw:bg-surface'
          : 'tw:border-black/15 tw:bg-white'
      )}>
      {renderContent()}
    </div>
  );
};

export default LogoPreview;
