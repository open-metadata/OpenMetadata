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
      dots
      beforeChange={(_, next) => setCurrentIndex(next)}
      easing="ease-in-out"
      effect="fade">
      {carouselContent.map((data, idx) => (
        <div
          className="slider-container"
          data-testid="slider-container"
          key={uniqueId() + '-' + currentIndex + '-' + idx}>
          <Typography.Title
            className="carousel-header"
            level={1}
            style={{
              color: '#fff',
              fontWeight: 700,
              fontSize: '2.5rem',
              marginBottom: 16,
            }}>
            {t(`label.${data.title}`)}
          </Typography.Title>
          <p
            className="carousal-description"
            data-testid="carousel-slide-description"
            style={{
              color: '#e0e7ef',
              fontSize: '1.25rem',
              marginBottom: 32,
            }}>
            {t(`message.${data.descriptionKey}`)}
          </p>
          <div className="image-container">
            <img
              alt="slider"
              className={data.imgClass}
              key={`main-${currentIndex}-${idx}`}
              src={data.image}
              style={{
                display: 'initial',
                maxWidth: '70%',
                borderRadius: '16px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
                zIndex: 2,
              }}
            />
            {data.image1 && (
              <img
                alt="slider"
                className={data.image1.position}
                key={`img1-${currentIndex}-${idx}`}
                src={data.image1.image}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '120px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                  zIndex: 1,
                }}
              />
            )}
            {data.image2 && (
              <img
                alt="slider"
                className={data.image2.position}
                key={`img2-${currentIndex}-${idx}`}
                src={data.image2.image}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '30%',
                  width: '120px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                  zIndex: 1,
                }}
              />
            )}
            {data.image3 && (
              <img
                alt="slider"
                className={data.image3.position}
                key={`img3-${currentIndex}-${idx}`}
                src={data.image3.image}
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: 0,
                  transform: 'translateX(-50%)',
                  width: '120px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                  zIndex: 1,
                }}
              />
            )}
          </div>
        </div>
      ))}
    </Carousel>
  );
};

export default LoginCarousel;
