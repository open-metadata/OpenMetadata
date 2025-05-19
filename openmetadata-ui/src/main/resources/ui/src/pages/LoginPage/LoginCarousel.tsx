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
        autoplay
        dots
        autoplaySpeed={5000}
        beforeChange={(_, next) => setCurrentIndex(next)}
        easing="ease-in-out"
        effect="fade">
        {carouselContent.map((data, idx) => (
          <div
            className="text-center"
            data-testid="slider-container"
            key={uniqueId() + '-' + currentIndex + '-' + idx}>
            <Typography.Title className="carousel-header" level={1}>
              {t(`label.${data.title}`)}
            </Typography.Title>
            <p
              className="m-b-lg carousal-description"
              data-testid="carousel-slide-description">
              {t(`message.${data.descriptionKey}`)}
            </p>
            <div className="image-container">
              <img
                alt="slider"
                key={`main-${currentIndex}-${idx}`}
                loading="lazy"
                src={data.image}
                style={{ display: 'initial' }}
                width={data.width}
              />
              {data.image1 && (
                <img
                  alt="slider"
                  className={data.image1.position}
                  key={`img1-${currentIndex}-${idx}`}
                  loading="lazy"
                  src={data.image1.image}
                  width={data.image1.width}
                />
              )}
              {data.image2 && (
                <img
                  alt="slider"
                  className={data.image2.position}
                  key={`img2-${currentIndex}-${idx}`}
                  loading="lazy"
                  src={data.image2.image}
                  width={data.image2.width}
                />
              )}
              {data.image3 && (
                <img
                  alt="slider"
                  className={data.image3.position}
                  key={`img3-${currentIndex}-${idx}`}
                  loading="lazy"
                  src={data.image3.image}
                  width={data.image3.width}
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
