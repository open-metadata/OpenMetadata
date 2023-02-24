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

import { CarouselProps } from 'antd';
import lineage from '../assets/img/lineage.webp';
import screenShot2 from '../assets/img/screenShot1.webp';
import screenShot1 from '../assets/img/screenShot2.webp';
import screenShot3 from '../assets/img/screenShot3.webp';
import screenShot4 from '../assets/img/screenShot4.webp';

export const LOGIN_SLIDE = [
  {
    image: screenShot1,
    descriptionKey: 'enables-end-to-end-metadata-management',
  },
  {
    image: screenShot2,
    descriptionKey: 'discover-your-data-and-unlock-the-value-of-data-assets',
  },
  {
    image: screenShot3,
    descriptionKey: 'assess-data-reliability-with-data-profiler-lineage',
  },
  {
    image: screenShot4,
    descriptionKey: 'fosters-collaboration-among-producers-and-consumers',
  },
  {
    image: lineage,
    descriptionKey: 'deeply-understand-table-relations-message',
  },
];

export const LOGIN_CAROUSEL_SETTINGS = {
  autoplay: true,
  prefixCls: 'login-carousel',
  dots: {
    className: 'carousel-dots',
  },
  slidesToShow: 1,
  slidesToScroll: 1,
} as CarouselProps;
