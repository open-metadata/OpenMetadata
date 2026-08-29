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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { Home01, Link02, SearchLg } from '@untitledui/icons';
import classNames from 'classnames';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import { getServiceLogo } from '../../../../utils/EntityDisplayUtils';

/** Dashed lineage edges drawn in the 600×132 illustration (y = 66). */
const EDGES = ['M170 66 H214', 'M386 66 H430'];

/** Orange junction dots where each edge meets the missing node. */
const DOT_X = [214, 386];

interface LineageNodeProps {
  logo: React.ReactNode;
  title: string;
  subtitle: string;
  positionClassName: string;
}

const LineageNode: FC<LineageNodeProps> = ({
  logo,
  title,
  subtitle,
  positionClassName,
}) => (
  <Box
    className={`tw:absolute tw:items-center tw:gap-2 tw:w-42.5 tw:px-3 tw:py-1.5 tw:rounded-[10px] tw:bg-primary tw:border tw:border-secondary tw:shadow-xs ${positionClassName}`}>
    <Box className="tw:shrink-0 tw:items-center tw:justify-center tw:w-7 tw:h-7 tw:rounded-full tw:bg-primary tw:border tw:border-secondary tw:shadow-xs">
      <Box className="tw:w-4 tw:h-4">{logo}</Box>
    </Box>
    <Box className="tw:flex-col tw:min-w-0">
      <Typography
        className="tw:text-[13px] tw:leading-tight tw:text-primary tw:whitespace-nowrap"
        weight="semibold">
        {title}
      </Typography>
      <Typography className="tw:text-[11px] tw:leading-tight tw:text-quaternary">
        {subtitle}
      </Typography>
    </Box>
  </Box>
);

/**
 * App-mode not-found page. The app-mode shell renders this at /404 instead of
 * delegating to the classic catch-all, so an unknown URL in app mode lands on a
 * branded page (with a stable `ai-not-found-page` testid) rather than a blank
 * screen from the fallback router's `Navigate → /404` with no element.
 */
const AINotFoundPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Box
      align="center"
      className="tw:relative tw:w-full tw:h-full tw:overflow-hidden tw:px-6"
      data-testid="ai-not-found-page"
      direction="col"
      justify="center">
      {/* Faded 404 watermark — inherits text color at low opacity so it
          stays subtle in both light and dark themes. */}
      <Typography
        aria-hidden
        className={classNames(
          'tw:pointer-events-none tw:select-none tw:absolute tw:top-1/2 tw:left-1/2 tw:z-0',
          'tw:-translate-x-1/2 tw:translate-y-[-52%] tw:leading-none',
          'tw:text-[360px] tw:tracking-[-0.04em] tw:opacity-[0.05]'
        )}
        weight="bold">
        404
      </Typography>

      <Box
        align="center"
        className="tw:relative tw:z-10 tw:text-center tw:max-w-lg"
        direction="col">
        <Box className="tw:relative tw:w-150 tw:h-33 tw:mb-6">
          <svg
            className="tw:pointer-events-none tw:absolute tw:inset-0 tw:w-full tw:h-full"
            fill="none"
            viewBox="0 0 600 132"
            xmlns="http://www.w3.org/2000/svg">
            {EDGES.map((d) => (
              <path
                className="tw:stroke-brand-300"
                d={d}
                fill="none"
                key={d}
                strokeDasharray="4 4"
                strokeLinecap="round"
                strokeWidth={2}>
                <animate
                  attributeName="stroke-dashoffset"
                  dur="1.4s"
                  from={0}
                  repeatCount="indefinite"
                  to={-16}
                />
              </path>
            ))}
            {DOT_X.map((cx) => (
              <circle
                className="tw:fill-(--color-bg-primary) tw:stroke-warning-600"
                cx={cx}
                cy={66}
                key={cx}
                r={3}
                strokeWidth={1.75}
              />
            ))}
          </svg>

          <LineageNode
            logo={getServiceLogo(
              'Snowflake',
              'tw:w-full tw:h-full tw:object-contain'
            )}
            positionClassName="tw:top-1/2 tw:-translate-y-1/2 tw:left-0"
            subtitle="snowflake · prod"
            title="raw_events"
          />
          <Box
            className={classNames(
              'tw:absolute tw:top-1/2 tw:left-53.75 tw:-translate-y-1/2 tw:flex-col',
              'tw:items-center tw:justify-center tw:gap-1.25 tw:w-42.5 tw:min-h-19.5',
              'tw:px-2.5 tw:py-1 tw:rounded-[10px] tw:bg-secondary',
              'tw:border-[1.5px] tw:border-dashed tw:border-secondary'
            )}>
            <Box className="tw:items-center tw:justify-center tw:w-7 tw:h-7 tw:rounded-full tw:bg-primary tw:border tw:border-secondary">
              <Link02 className="tw:w-4 tw:h-4 tw:text-fg-quaternary" />
            </Box>
            <Typography
              className="tw:text-[11px] tw:text-quaternary"
              weight="semibold">
              {t('label.asset-not-found')}
            </Typography>
            <Typography className="tw:text-[10px] tw:text-utility-error-700 tw:bg-utility-error-50 tw:border tw:border-utility-error-200 tw:rounded-[5px] tw:px-1.5 tw:py-0.5">
              404
            </Typography>
          </Box>

          <LineageNode
            logo={getServiceLogo(
              'Tableau',
              'tw:w-full tw:h-full tw:object-contain'
            )}
            positionClassName="tw:top-1/2 tw:-translate-y-1/2 tw:left-[430px]"
            subtitle="tableau"
            title="sales_dashboard"
          />
        </Box>

        <Typography
          as="p"
          className="tw:pt-2.5 tw:text-[28px] tw:leading-[1.2] tw:tracking-[-0.02em] tw:text-primary"
          weight="bold">
          {t('message.ai-asset-not-found-title')}
        </Typography>
        <Typography
          as="p"
          className="tw:pt-2 tw:max-w-105 tw:text-[15px] tw:leading-[1.55] tw:text-tertiary">
          {t('message.ai-asset-not-found-description')}
        </Typography>

        <Box className="tw:items-center tw:gap-3 tw:mt-6">
          <Button
            data-testid="ai-not-found-home-button"
            iconLeading={<Home01 className="tw:w-5 tw:h-5 tw:text-fg-white" />}
            size="md"
            onPress={() => navigate(ROUTES.HOME)}>
            {t('label.back-to-home')}
          </Button>
          <Button
            color="secondary"
            data-testid="ai-not-found-explore-button"
            iconLeading={<SearchLg className="tw:w-5 tw:h-5" />}
            size="md"
            onPress={() => navigate(ROUTES.EXPLORE)}>
            {t('label.explore')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default AINotFoundPage;
