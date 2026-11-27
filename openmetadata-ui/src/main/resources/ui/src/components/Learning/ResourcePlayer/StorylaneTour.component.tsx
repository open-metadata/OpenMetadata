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

import { Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSafeHttpUrl } from '../../../utils/StringUtils';
import Loader from '../../common/Loader/Loader';
import './storylane-tour.less';

interface StorylaneTourProps {
  url: string;
  title: string;
  /** Fill the caller's space instead of the player's 16:9 box. */
  fill?: boolean;
  /** Layout only: placement and size in the caller. */
  className?: string;
}

export const StorylaneTour: React.FC<StorylaneTourProps> = ({
  url,
  title,
  fill = false,
  className,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  // Same rule as VideoPlayer: the frame allows scripts and same-origin, so only
  // an http(s) URL may become its src.
  const tourUrl = getSafeHttpUrl(url);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  if (!tourUrl) {
    return (
      <div className="tw:p-4">
        <Typography as="span" size="text-sm">
          {t('label.invalid-url')}
        </Typography>
      </div>
    );
  }

  return (
    <div
      className={classNames(
        'storylane-tour-wrapper',
        { 'storylane-tour-wrapper--fill': fill },
        className
      )}>
      <div className="storylane-tour-container">
        {isLoading && (
          <div className="storylane-tour-loading">
            <Loader />
          </div>
        )}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- onLoad hides spinner */}
        <iframe
          className="storylane-tour-iframe"
          frameBorder="0"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms"
          src={tourUrl}
          title={title}
          onLoad={handleLoad}
        />
      </div>
    </div>
  );
};
