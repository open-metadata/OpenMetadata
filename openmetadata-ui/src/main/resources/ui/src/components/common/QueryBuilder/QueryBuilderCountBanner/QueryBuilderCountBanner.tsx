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
import { Alert, Button, Skeleton } from '@openmetadata/ui-core-components';
import { InfoCircle } from '@untitledui/icons';
import classNames from 'classnames';
import { isNil } from 'lodash';
import { useTranslation } from 'react-i18next';
import { QueryBuilderCountBannerProps } from './QueryBuilderCountBanner.types';

const DEFAULT_LINK_LABEL_KEY = 'message.click-here-to-view-assets-on-explore';
const DEFAULT_TITLE_KEY = 'message.search-entity-count';

/**
 * The single "N assets found" banner for every query builder surface.
 *
 * It renders the count only — each screen counts something the builder cannot
 * derive on its own (merged chip filters, several entity types, a parent's
 * own resource count), so the caller owns the number and this owns the markup.
 */
const QueryBuilderCountBanner = ({
  className,
  count,
  'data-testid': testId = 'view-assets-banner-count',
  exploreUrl,
  isLoading = false,
  linkLabelKey = DEFAULT_LINK_LABEL_KEY,
  target = '_blank',
  titleKey = DEFAULT_TITLE_KEY,
}: QueryBuilderCountBannerProps) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Skeleton
        animation="pulse"
        className={classNames('tw:mt-2', className)}
        height={32}
        variant="rectangular"
      />
    );
  }

  if (isNil(count)) {
    return null;
  }

  return (
    <Alert
      closable
      className={classNames('tw:mt-2', className)}
      data-testid={testId}
      icon={InfoCircle}
      title={t(titleKey, { count })}
      // A count of zero is a valid answer, not an error: the filter ran and
      // matched nothing. Colouring it red reads as a failure.
      variant="brand">
      {/* The link is a control inside the banner, never a wrapper around it.
          An anchor around the whole Alert puts the close button inside a link,
          so dismissing the banner would navigate instead of closing it, and it
          nests one interactive control inside another. */}
      {Boolean(exploreUrl) && (
        <Button
          className="tw:no-underline tw:hover:no-underline"
          color="link-color"
          data-testid="view-assets-banner-button"
          href={exploreUrl}
          rel="noreferrer"
          size="sm"
          target={target}>
          {t(linkLabelKey)}
        </Button>
      )}
    </Alert>
  );
};

export default QueryBuilderCountBanner;
