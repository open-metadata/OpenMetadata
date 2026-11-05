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
import { ButtonUtility, Typography } from '@openmetadata/ui-core-components';
import { Copy01 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '../../../hooks/useClipBoard';

export interface EntityPageTitleProps {
  name: string;
  displayName?: string;
  icon?: ReactNode;
  deleted?: boolean;
  /** Rendered after the copy button, e.g. a `LearningIcon`. */
  actions?: ReactNode;
  /** Status and other badges, kept level with the title line. */
  badges?: ReactNode;
  testId?: string;
}

export const EntityPageTitle = ({
  name,
  displayName,
  icon,
  deleted,
  actions,
  badges,
  testId,
}: EntityPageTitleProps) => {
  const { t } = useTranslation();
  const { onCopyToClipBoard, hasCopied } = useClipboard('', 2000);
  const hasDisplayName = !isEmpty(displayName);

  return (
    <div
      className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-3"
      data-testid={testId}>
      {icon}
      <div
        className="tw:flex tw:min-w-0 tw:items-start tw:gap-3"
        data-testid="entity-header-title">
        <div className="tw:flex tw:min-w-0 tw:flex-col">
          {hasDisplayName && (
            <Typography
              as="h2"
              className="tw:m-0 tw:min-w-0 tw:truncate tw:text-primary tw:text-left"
              data-testid="entity-header-display-name"
              ellipsis={{ tooltip: displayName }}
              size="text-lg"
              weight="bold">
              {displayName}
            </Typography>
          )}
          <Typography
            as={hasDisplayName ? 'span' : 'h2'}
            className={classNames(
              'tw:m-0 tw:block tw:min-w-0 tw:truncate tw:text-left',
              hasDisplayName ? 'tw:text-tertiary' : 'tw:text-primary'
            )}
            data-testid="entity-header-name"
            ellipsis={{ tooltip: name }}
            size={hasDisplayName ? 'text-sm' : 'text-lg'}
            weight={hasDisplayName ? 'medium' : 'bold'}>
            {name}
          </Typography>
        </div>
        {/* h-8 = the title line, so the actions stay level with the title
            rather than centring across title + name. */}
        <div className="tw:flex tw:h-8 tw:shrink-0 tw:items-center tw:gap-3">
          {deleted && (
            <span className="deleted-badge-button" data-testid="deleted-badge">
              {t('label.deleted')}
            </span>
          )}
          <ButtonUtility
            data-testid="entity-header-copy-button"
            icon={Copy01}
            size="lg"
            tooltip={
              hasCopied
                ? t('message.link-copy-to-clipboard')
                : t('label.copy-item', { item: t('label.url-uppercase') })
            }
            onClick={() => onCopyToClipBoard(globalThis.location.href)}
          />
          {actions}
        </div>
      </div>
      <div className="tw:flex tw:h-8 tw:shrink-0 tw:items-center tw:gap-3 tw:self-start">
        {badges}
      </div>
    </div>
  );
};
