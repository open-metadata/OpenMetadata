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
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { Copy01 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '../../../hooks/useClipBoard';
import { renderHighlightedText } from '../../../utils/EntitySearchUtils';

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
  // Version views pass getTextDiff HTML; render its diff spans as elements.
  const displayNameNode = renderHighlightedText(displayName);
  const nameNode = renderHighlightedText(name);

  return (
    <Box
      align="center"
      className="tw:min-w-0 tw:flex-1"
      data-testid={testId}
      gap={3}>
      {icon}
      <Box
        align="start"
        className="tw:min-w-0"
        data-testid="entity-header-title"
        gap={3}>
        <Box className="tw:min-w-0" direction="col">
          {hasDisplayName && (
            <Typography
              as="h2"
              className="tw:m-0 tw:min-w-0 tw:truncate tw:text-primary tw:text-left"
              data-testid="entity-header-display-name"
              ellipsis={{ tooltip: displayNameNode }}
              size="text-lg"
              weight="bold">
              {displayNameNode}
            </Typography>
          )}
          <Typography
            as={hasDisplayName ? 'span' : 'h2'}
            className={classNames(
              'tw:m-0 tw:block tw:min-w-0 tw:truncate tw:text-left',
              hasDisplayName ? 'tw:text-tertiary' : 'tw:text-primary'
            )}
            data-testid="entity-header-name"
            ellipsis={{ tooltip: nameNode }}
            size={hasDisplayName ? 'text-sm' : 'text-lg'}
            weight={hasDisplayName ? 'medium' : 'bold'}>
            {nameNode}
          </Typography>
        </Box>
        {/* h-8 = the title line, so the actions stay level with the title
            rather than centring across title + name. */}
        <Box align="center" className="tw:h-8 tw:shrink-0" gap={3}>
          {deleted && (
            <Badge
              color="error"
              data-testid="deleted-badge"
              size="sm"
              type="pill-color">
              {t('label.deleted')}
            </Badge>
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
        </Box>
      </Box>
      <Box align="center" className="tw:h-8 tw:shrink-0 tw:self-start" gap={3}>
        {badges}
      </Box>
    </Box>
  );
};
