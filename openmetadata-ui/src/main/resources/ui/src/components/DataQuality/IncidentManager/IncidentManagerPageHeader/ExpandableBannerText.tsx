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

import { Button, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ExpandableBannerTextProps {
  className?: string;
  dataTestId: string;
  text: string;
}

const ExpandableBannerText = ({
  className,
  dataTestId,
  text,
}: ExpandableBannerTextProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const textRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setExpanded(false);
  }, [text]);

  useEffect(() => {
    const textElement = textRef.current;

    if (!textElement || expanded) {
      return;
    }

    const updateOverflow = () =>
      setHasOverflow(textElement.scrollWidth > textElement.clientWidth);
    const resizeObserver = globalThis.ResizeObserver
      ? new ResizeObserver(updateOverflow)
      : undefined;

    updateOverflow();
    resizeObserver?.observe(textElement);
    globalThis.addEventListener('resize', updateOverflow);

    return () => {
      resizeObserver?.disconnect();
      globalThis.removeEventListener('resize', updateOverflow);
    };
  }, [expanded, text]);

  return (
    // A div, not a p: Typography wraps a p in .prose, and the wrapper, not
    // this flex item, would then have to shrink for the text to truncate.
    <Typography
      as="div"
      className={classNames(
        'tw:min-w-0 tw:break-all',
        expanded ? 'tw:block' : 'tw:flex tw:items-baseline tw:gap-1',
        className
      )}
      color="secondary"
      data-testid={dataTestId}
      size="text-xs">
      <Typography
        className={classNames({
          'tw:min-w-0 tw:flex-1 tw:truncate': !expanded,
        })}
        data-testid={`${dataTestId}-content`}
        ref={textRef}>
        {text}
      </Typography>
      {!expanded && hasOverflow && (
        <Button
          className="tw:inline-flex tw:h-auto tw:shrink-0 tw:p-0 tw:align-baseline tw:text-xs"
          color="link-color"
          data-testid={`${dataTestId}-more-button`}
          onPress={() => setExpanded(true)}>
          {t('label.more-lowercase')}
        </Button>
      )}
      {expanded && hasOverflow && (
        <Button
          className="tw:ml-1 tw:inline-flex tw:h-auto tw:p-0 tw:align-baseline tw:text-xs"
          color="link-color"
          data-testid={`${dataTestId}-less-button`}
          onPress={() => setExpanded(false)}>
          {t('label.less-lowercase')}
        </Button>
      )}
    </Typography>
  );
};

export default ExpandableBannerText;
