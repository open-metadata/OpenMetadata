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
import { Carousel, Typography } from 'antd';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import {
  CustomNextArrow,
  CustomPrevArrow,
} from '../../../../utils/CustomizableLandingPageCarouselUtils';
import { getEntityLinkFromType } from '../../../../utils/EntityLinkUtils';
import { getEntityIcon } from '../../../../utils/LandingPageWidgetIconUtils';
import { getRecentlyViewedData } from '../../../../utils/RecentActivityUtils';

interface RecentlyViewedCarouselProps {
  disabled?: boolean;
  showAnnouncements?: boolean;
}

const RecentlyViewedCarousel = ({
  disabled,
  showAnnouncements,
}: RecentlyViewedCarouselProps) => {
  const navigate = useNavigate();

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

  return (
    <Carousel
      arrows
      className={classNames('recently-viewed-data-carousel', {
        'slick-list-center': !showAnnouncements,
      })}
      infinite={false}
      nextArrow={<CustomNextArrow />}
      prevArrow={<CustomPrevArrow />}
      responsive={[
        {
          breakpoint: 1900,
          settings: {
            slidesToShow: 8,
            slidesToScroll: 8,
          },
        },
        {
          breakpoint: 1600,
          settings: {
            slidesToShow: 6,
            slidesToScroll: 6,
          },
        },
        {
          breakpoint: 1300,
          settings: {
            slidesToShow: 4,
            slidesToScroll: 4,
          },
        },
      ]}
      slidesToScroll={10}
      slidesToShow={10}>
      {recentlyViewData.map((data, index) => (
        <div
          className={classNames('customise-recently-viewed-data', {
            disabled,
          })}
          data-testid="recently-viewed-asset"
          key={index}
          role="button"
          tabIndex={0}
          onClick={() => navigateToEntity(data)}>
          <div
            className="recent-item d-flex flex-col items-center gap-3"
            key={data.name}>
            <div className="d-flex items-center justify-center entity-icon-container">
              {data.icon}
            </div>
            <Typography.Text
              className="text-sm font-medium text-white"
              ellipsis={{ tooltip: true }}>
              {data.name}
            </Typography.Text>
          </div>
        </div>
      ))}
    </Carousel>
  );
};

export default RecentlyViewedCarousel;
