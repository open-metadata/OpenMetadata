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

import { Carousel } from 'antd';
import { t } from 'i18next';
import { uniqueId } from 'lodash';
import React from 'react';
import {
  LOGIN_CAROUSEL_SETTINGS,
  LOGIN_SLIDE,
} from '../../constants/Login.constants';

const LoginCarousel = () => {
  return (
    <div data-testid="carousel-container" style={{ width: '85%' }}>
      <Carousel {...LOGIN_CAROUSEL_SETTINGS}>
        {LOGIN_SLIDE.map((data) => (
          <div data-testid="slider-container" key={uniqueId()}>
            <div>
              <img
                alt="slider"
                className="w-full"
                loading="lazy"
                src={data.image}
              />
            </div>
            <div className="mt-24 mb-11">
              <p
                className="text-center carousal-description font-medium text-white text-xl"
                data-testid="carousel-slide-description">
                {t(`message.${data.descriptionKey}`)}
              </p>
            </div>
          </div>
        ))}
      </Carousel>
    </div>
  );
};

export default LoginCarousel;
