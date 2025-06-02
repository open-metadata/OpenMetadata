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
    <div className="carousal-container" data-testid="carousel-container">
      <Carousel
        dots
        beforeChange={(_, next) => setCurrentIndex(next)}
        easing="ease-in-out"
        effect="fade">
        {carouselContent.map((data, idx) => (
          <div
            className="text-center"
            data-testid="slider-container"
            key={uniqueId() + '-' + currentIndex + '-' + idx}
            style={{ padding: '24px' }}>
            <Typography.Title className="carousel-header" level={1}>
              {t(`label.${data.title}`)}
            </Typography.Title>
            <p
              className="carousal-description"
              data-testid="carousel-slide-description">
              {t(`message.${data.descriptionKey}`)}
            </p>
            <div className="image-container">
              <img
                alt="slider"
                className={data.imgClass}
                key={`main-${currentIndex}-${idx}`}
                src={data.image}
                style={{ display: 'initial' }}
              />
              {data.image1 && (
                <img
                  alt="slider"
                  className={data.image1.position}
                  key={`img1-${currentIndex}-${idx}`}
                  src={data.image1.image}
                />
              )}
              {data.image2 && (
                <img
                  alt="slider"
                  className={data.image2.position}
                  key={`img2-${currentIndex}-${idx}`}
                  src={data.image2.image}
                />
              )}
              {data.image3 && (
                <img
                  alt="slider"
                  className={data.image3.position}
                  key={`img3-${currentIndex}-${idx}`}
                  src={data.image3.image}
                />
              )}
            </div>
          </div>
        ))}
      </Carousel>
    </div>
  );
};

export default LoginCarousel;
