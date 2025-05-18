/*
 *  Copyright 2022 Collate.
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
import { t } from 'i18next';
import { uniqueId } from 'lodash';
import React from 'react';
import loginClassBase from '../../constants/LoginClassBase';

const LoginCarousel = () => {
  const carouselContent = loginClassBase.getLoginCarouselContent();

  return (
    <div className="carousal-container" data-testid="carousel-container">
      <Carousel
        autoplay
        dots
        autoplaySpeed={5000}
        easing="ease-in-out"
        effect="fade">
        {carouselContent.map((data) => (
          <div
            className="text-center"
            data-testid="slider-container"
            key={uniqueId()}>
            <Typography.Title className="carousel-header" level={1}>
              {t(`label.${data.title}`)}
            </Typography.Title>
            <p
              className="m-b-lg carousal-description"
              data-testid="carousel-slide-description">
              {t(`message.${data.descriptionKey}`)}
            </p>
            <img
              alt="slider"
              loading="lazy"
              src={data.image}
              style={{ display: 'initial' }}
              width={data.width}
            />
          </div>
        ))}
      </Carousel>
    </div>
  );
};

export default LoginCarousel;
