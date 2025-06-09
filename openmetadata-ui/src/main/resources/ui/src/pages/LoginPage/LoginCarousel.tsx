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
      autoplaySpeed={2000}
      beforeChange={(_, next) => setCurrentIndex(next)}
      easing="ease-in-out"
      effect="fade">
      {carouselContent.map((data, idx) => (
        <div
          className="slider-container"
          data-testid="slider-container"
          key={uniqueId() + '-' + currentIndex + '-' + idx}>
          <div className="d-flex flex-col gap-4">
            <Typography.Title
              className="carousel-header"
              level={1}
              style={{
                color: '#fff',
                fontWeight: 700,
                fontSize: '2.5rem',
              }}>
              {t(`label.${data.title}`)}
            </Typography.Title>
            <p
              className="carousal-description"
              data-testid="carousel-slide-description"
              style={{
                color: '#e0e7ef',
                fontSize: '1.25rem',
              }}>
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
