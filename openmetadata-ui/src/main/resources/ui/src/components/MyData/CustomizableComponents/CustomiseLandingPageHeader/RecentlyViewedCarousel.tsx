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
  Box,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronLeft,
  ChevronRight,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import { getEntityLinkFromType } from '../../../../utils/EntityLinkUtils';
import { getEntityIcon } from '../../../../utils/LandingPageWidgetIconUtils';
import { getRecentlyViewedData } from '../../../../utils/RecentActivityUtils';

interface RecentlyViewedCarouselProps {
  disabled?: boolean;
}

// Viewport max-widths mirroring the slick carousel this replaced.
const SLIDES_BY_MAX_WIDTH = [
  { maxWidth: 1300, slides: 4 },
  { maxWidth: 1600, slides: 6 },
  { maxWidth: 1900, slides: 8 },
];
const MAX_SLIDES = 10;

const getSlidesToShow = () =>
  SLIDES_BY_MAX_WIDTH.find(({ maxWidth }) => window.innerWidth <= maxWidth)
    ?.slides ?? MAX_SLIDES;

const ARROW_CLASS = 'custom-arrow tw:p-0';
const ARROW_ICON_CLASS = 'tw:size-3 tw:text-fg-white';

const RecentlyViewedCarousel = ({ disabled }: RecentlyViewedCarouselProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [slidesToShow, setSlidesToShow] = useState(getSlidesToShow);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const handleResize = () => setSlidesToShow(getSlidesToShow());
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const recentlyViewData = useMemo(() => {
    const entities = getRecentlyViewedData();

    return entities.map((entity) => {
      return {
        icon: getEntityIcon(
          {
            entityType: entity.entityType,
            name: entity.displayName,
            serviceType: entity.serviceType,
          },
          undefined,
          'entity-icon'
        ),
        name: entity.displayName,
        entityType: entity.entityType,
        fullyQualifiedName: entity.fqn,
      };
    });
  }, []);

  const navigateToEntity = (data: {
    entityType: string;
    fullyQualifiedName: string;
  }) => {
    const path = getEntityLinkFromType(
      data.fullyQualifiedName,
      data.entityType as EntityType
    );

    if (!path) {
      return;
    }

    navigate(path);
  };

  if (recentlyViewData.length === 0) {
    return null;
  }

  const pageCount = Math.ceil(recentlyViewData.length / slidesToShow);
  // A resize can shrink the page count below the page we were on.
  const currentPage = Math.min(page, pageCount - 1);
  const isPaged = pageCount > 1;
  const firstVisible = currentPage * slidesToShow;

  return (
    <Box
      className="tw:relative tw:mb-9 tw:max-h-[125px] tw:w-full tw:pb-1"
      data-testid="recently-viewed-carousel"
      direction="col">
      <Box className="tw:w-full tw:overflow-hidden">
        <Box
          className="tw:w-full tw:transition-transform tw:duration-500 tw:motion-reduce:transition-none"
          style={{ transform: `translateX(-${currentPage * 100}%)` }}>
          {recentlyViewData.map((data, index) => {
            const isVisible =
              index >= firstVisible && index < firstVisible + slidesToShow;

            return (
              <div
                aria-hidden={!isVisible}
                aria-label={data.name}
                className={classNames(
                  'customise-recently-viewed-data tw:shrink-0 tw:px-2',
                  { disabled }
                )}
                data-testid="recently-viewed-asset"
                key={data.fullyQualifiedName}
                role="button"
                style={{ width: `${100 / slidesToShow}%` }}
                tabIndex={isVisible ? 0 : -1}
                onClick={() => navigateToEntity(data)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigateToEntity(data);
                  }
                }}>
                <Box
                  align="center"
                  className="recent-item"
                  direction="col"
                  gap={3}>
                  <Box
                    align="center"
                    className="entity-icon-container"
                    justify="center">
                    {data.icon}
                  </Box>
                  <Typography
                    className="tw:max-w-full text-sm font-medium text-white"
                    ellipsis={{
                      tooltip: true,
                      excludeTriggerFromTabOrder: true,
                    }}>
                    {data.name}
                  </Typography>
                </Box>
              </div>
            );
          })}
        </Box>
      </Box>
      {isPaged && (
        <>
          <ButtonUtility
            aria-label={t('label.previous')}
            className={`${ARROW_CLASS} left-arrow`}
            color="tertiary"
            data-testid="recently-viewed-prev"
            icon={<ChevronLeft className={ARROW_ICON_CLASS} strokeWidth={3} />}
            isDisabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          />
          <ButtonUtility
            aria-label={t('label.next')}
            className={`${ARROW_CLASS} right-arrow`}
            color="tertiary"
            data-testid="recently-viewed-next"
            icon={<ChevronRight className={ARROW_ICON_CLASS} strokeWidth={3} />}
            isDisabled={currentPage === pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          />
          <Box
            className="tw:absolute tw:inset-x-0 tw:-bottom-3 tw:z-15 tw:mx-[15%] tw:gap-1.5"
            justify="center">
            {Array.from({ length: pageCount }, (_, index) => (
              <ButtonUtility
                aria-current={index === currentPage}
                aria-label={`${t('label.page')} ${index + 1}`}
                className={classNames(
                  'tw:h-[3px] tw:rounded-[1px] tw:bg-fg-white tw:p-0 tw:transition-all tw:duration-500',
                  'tw:after:absolute tw:after:-inset-1',
                  index === currentPage
                    ? 'tw:w-6 tw:opacity-100 tw:hover:bg-fg-white'
                    : 'tw:w-4 tw:opacity-30 tw:hover:bg-fg-white tw:hover:opacity-75'
                )}
                color="tertiary"
                data-testid="recently-viewed-dot"
                key={index}
                onClick={() => setPage(index)}
              />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

export default RecentlyViewedCarousel;
