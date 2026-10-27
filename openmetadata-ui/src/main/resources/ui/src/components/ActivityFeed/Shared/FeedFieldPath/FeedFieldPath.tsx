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
import { Box, Typography } from '@openmetadata/ui-core-components';
import { ChevronRight, Column } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import entityUtilClassBase from '../../../../utils/EntityUtilClassBase';
import {
  getFeedFieldDefaultLabel,
  getFeedFieldLabelKey,
  getFeedFieldPath,
} from './FeedFieldPath.utils';

export interface FeedFieldPathProps {
  about?: string;
  entityType?: string;
  // An activity event's header already names the field it changed.
  showField?: boolean;
  /**
   * Replaces the default `tw:min-w-0`, which lets the trail shrink below its
   * separators and field label. A caller that needs the field kept whole while
   * a long column name truncates passes `tw:min-w-min`.
   */
  className?: string;
  /** Caps a long column name, so the trail's minimum width stays bounded. */
  truncateColumn?: boolean;
}

const getColumnLinkClassName = (truncateColumn?: boolean) =>
  classNames(
    'tw:truncate tw:text-sm tw:text-brand-secondary tw:hover:underline',
    truncateColumn && 'tw:max-w-24'
  );

const Separator = () => (
  <ChevronRight
    aria-hidden="true"
    className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
  />
);

/**
 * The trail after a feed card's entity link for a thread or change on one of
 * its fields: `› [column] last_name › Description`. Renders nothing for an
 * entity-level link.
 */
const FeedFieldPath = ({
  about,
  entityType,
  showField = true,
  className = 'tw:min-w-0',
  truncateColumn,
}: FeedFieldPathProps) => {
  const { t } = useTranslation();
  const path = useMemo(() => getFeedFieldPath(about), [about]);

  const field = showField ? path?.field : undefined;

  if (!entityType || !(path?.child || field)) {
    return null;
  }

  return (
    <Box
      inline
      align="center"
      className={classNames('tw:gap-1.5', className)}
      data-testid="feed-field-path">
      {path?.child && <Separator />}
      {path?.child?.columnFqn && (
        <>
          <Column
            aria-hidden="true"
            className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
          />
          <Link
            className={getColumnLinkClassName(truncateColumn)}
            data-testid="feed-field-path-column"
            to={entityUtilClassBase.getEntityLink(
              entityType,
              path.child.columnFqn
            )}>
            {path.child.name}
          </Link>
        </>
      )}
      {path?.child && !path.child.columnFqn && (
        <Typography
          as="span"
          className="tw:truncate"
          data-testid="feed-field-path-child"
          size="text-sm">
          {path.child.name}
        </Typography>
      )}
      {field && (
        <>
          <Separator />
          <Typography
            as="span"
            className="tw:min-w-0 tw:truncate"
            color="secondary"
            data-testid="feed-field-path-field"
            size="text-sm"
            weight="semibold">
            {t(getFeedFieldLabelKey(field), {
              defaultValue: getFeedFieldDefaultLabel(field),
            })}
          </Typography>
        </>
      )}
    </Box>
  );
};

export default FeedFieldPath;
