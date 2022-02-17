/*
 *  Copyright 2021 Collate
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

import { uniqueId } from 'lodash';
import React from 'react';
import Slider from 'react-slick';
import {
  LOGIN_SLIDE,
  LOGIN_SLIDER_SETTINGS,
} from '../../constants/login.const';

const LoginCarousel = () => {
  return (
    <div data-testid="carousel-container" style={{ width: '85%' }}>
      <Slider {...LOGIN_SLIDER_SETTINGS}>
        {LOGIN_SLIDE.map((data) => (
          <div data-testid="slider-container" key={uniqueId()}>
            <div>
              <img alt="slider" className="tw-w-full" src={data.image} />
            </div>
            <div className="tw-mt-24 tw-mb-11">
              <p
                className="tw-text-center tw-w-5/6 tw-mx-auto tw-font-medium tw-text-white tw-text-xl"
                data-testid="carousel-slide-description">
                {data.description}
              </p>
            </div>
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default LoginCarousel;
