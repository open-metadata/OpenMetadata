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
import React, { useState } from 'react';
import loginClassBase from '../../constants/LoginClassBase';

const LoginCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselContent = loginClassBase.getLoginCarouselContent();

  return (
    <Carousel
      autoplay
      dots
      autoplaySpeed={5000}
      beforeChange={(_, next) => setCurrentIndex(next)}
      easing="ease-in-out"
      effect="fade">
      {carouselContent.map((data, idx) => (
        <div
          className="slider-container"
          data-testid="slider-container"
          key={uniqueId() + '-' + currentIndex + '-' + idx}>
          <div className="d-flex flex-col gap-4">
            <Typography.Title className="carousel-header display-md" level={1}>
              {t(`label.${data.title}`)}
            </Typography.Title>
            <p
              className="carousal-description text-sm p-x-lg"
              data-testid="carousel-slide-description">
              {t(`message.${data.descriptionKey}`)}
            </p>
          </div>
          <div className="image-container">
            <img alt="slider" className="main-image" src={data.image} />
          </div>
        </div>
      ))}
    </Carousel>
  );
};

export default LoginCarousel;
