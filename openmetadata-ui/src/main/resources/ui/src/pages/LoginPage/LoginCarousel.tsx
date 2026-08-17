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
import { uniqueId } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import loginClassBase from '../../constants/LoginClassBase';

const LoginCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselContent = loginClassBase.getLoginCarouselContent();
  const loginVideo = loginClassBase.getLoginVideo();
  const { t } = useTranslation();

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
    []
  );

  if (loginVideo) {
    return (
      <video
        aria-hidden
        muted
        playsInline
        autoPlay={!prefersReducedMotion}
        className="tw:absolute tw:inset-0 tw:h-full tw:w-full tw:object-cover"
        data-testid="login-video"
        loop={!prefersReducedMotion}
        src={loginVideo}
      />
    );
  }

  return (
    <Carousel
      autoplay
      dots
      autoplaySpeed={5000}
      beforeChange={(_, next) => setCurrentIndex(next)}
      className="login-carousel"
      data-testid="carousel-container"
      easing="ease-in-out"
      effect="fade">
      {carouselContent.map((data, idx) => (
        <div
          className="slider-container"
          data-testid="slider-container"
          key={uniqueId() + '-' + currentIndex + '-' + idx}>
          <div className="text-container d-flex flex-col gap-4">
            <Typography.Title className="carousel-header display-md" level={1}>
              {t(`label.${data.title}`)}
            </Typography.Title>
            <p
              className="carousal-description text-md p-x-lg"
              data-testid="carousel-slide-description">
              {t(`message.${data.descriptionKey}`)}
            </p>
          </div>

          <img alt="slider" className="main-image" src={data.image} />
        </div>
      ))}
    </Carousel>
  );
};

export default LoginCarousel;
