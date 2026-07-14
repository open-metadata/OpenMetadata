/*
 *  Copyright 2025 Collate.
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
import type { ReactNode } from 'react';
import { Box } from '@/components/base/box/box';
import { Typography } from '@/components/foundations/typography';
import { cx } from '@/utils/cx';
import type {
  EmptyPlaceholderFeature,
  EmptyPlaceholderShellProps,
} from './empty-placeholder-shell';
import {
  EMPTY_PLACEHOLDER_ICON_BOX,
  EmptyPlaceholderShell,
  renderEmptyPlaceholderActions,
  renderEmptyPlaceholderIcon,
} from './empty-placeholder-shell';

const FeatureItem = ({
  icon,
  title,
  description,
  iconClassName,
}: Omit<EmptyPlaceholderFeature, 'key'>) => (
  <Box
    align="center"
    className="tw:max-w-[220px] tw:text-center"
    direction="col"
    gap={5}>
    <div className={cx(EMPTY_PLACEHOLDER_ICON_BOX, iconClassName)}>
      {renderEmptyPlaceholderIcon(icon, 'tw:size-7')}
    </div>
    <Box align="center" direction="col" gap={1}>
      <Typography size="text-sm" weight="semibold">
        {title}
      </Typography>
      {description && (
        <Typography className="tw:text-tertiary" size="text-sm">
          {description}
        </Typography>
      )}
    </Box>
  </Box>
);

export interface FeaturesEmptyPlaceholderProps
  extends Omit<EmptyPlaceholderShellProps, 'children'> {
  title?: ReactNode;
  description?: ReactNode;
  features?: EmptyPlaceholderFeature[];
}

const FEATURES_BACKGROUND = 'var(--gradient-empty-placeholder-features)';

export const FeaturesEmptyPlaceholder = ({
  title,
  description,
  features,
  actions,
  footer,
  style,
  ...rest
}: FeaturesEmptyPlaceholderProps) => {
  const hasHeader = Boolean(title || description);
  const hasFeatures = Boolean(features && features.length > 0);
  const footerNode = footer ?? renderEmptyPlaceholderActions(actions);

  return (
    <EmptyPlaceholderShell
      gap={0}
      style={{ background: FEATURES_BACKGROUND, ...style }}
      {...rest}>
      {hasHeader && (
        <Box
          align="center"
          className="tw:max-w-lg tw:gap-1.5 tw:text-center"
          direction="col">
          {title && (
            <Typography size="text-lg" weight="semibold">
              {title}
            </Typography>
          )}
          {description && (
            <Typography className="tw:text-tertiary" size="text-sm">
              {description}
            </Typography>
          )}
        </Box>
      )}
      {hasFeatures && (
        <Box
          align="start"
          className={cx(hasHeader && 'tw:mt-[30px]')}
          gap={10}
          justify="center"
          wrap="wrap">
          {features?.map(({ key, ...feature }) => (
            <FeatureItem key={key} {...feature} />
          ))}
        </Box>
      )}
      {footerNode && (
        <div className={cx((hasHeader || hasFeatures) && 'tw:mt-[22px]')}>
          {footerNode}
        </div>
      )}
    </EmptyPlaceholderShell>
  );
};
