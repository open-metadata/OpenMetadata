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

import { Button } from '@openmetadata/ui-core-components';
import { Typography } from 'antd';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    setExpanded(false);
  }, [text]);

  return (
    <Typography.Paragraph
      className={classNames(
        'tw:!mb-0 tw:min-w-0 tw:text-xs tw:leading-normal tw:text-secondary',
        className
      )}
      data-testid={dataTestId}
      ellipsis={
        expanded
          ? false
          : {
              rows: 1,
              expandable: true,
              onEllipsis: setHasOverflow,
              onExpand: () => setExpanded(true),
              symbol: (
                <span
                  className="tw:text-brand-primary"
                  data-testid={`${dataTestId}-more-button`}>
                  {t('label.more-lowercase')}
                </span>
              ),
            }
      }>
      {text}
      {expanded && hasOverflow && (
        <Button
          className="tw:ml-1 tw:inline-flex tw:h-auto tw:p-0 tw:align-baseline tw:text-xs"
          color="link-color"
          data-testid={`${dataTestId}-less-button`}
          onPress={() => setExpanded(false)}>
          {t('label.less-lowercase')}
        </Button>
      )}
    </Typography.Paragraph>
  );
};

export default ExpandableBannerText;
