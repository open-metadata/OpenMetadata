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
import collaborationImg from '../assets/img/screenShot1.png';
import discoveryImg from '../assets/img/screenShot2.png';
import dataQualityImg from '../assets/img/screenShot3.png';
import governanceImg from '../assets/img/screenShot4.png';
import insightImg from '../assets/img/screenShot5.png';

export const LOGIN_SLIDE = [
  {
    title: 'discovery',
    image: discoveryImg,
    descriptionKey: 'enables-end-to-end-metadata-management',
  },
  {
    title: 'data-quality',
    image: dataQualityImg,
    descriptionKey: 'discover-your-data-and-unlock-the-value-of-data-assets',
  },
  {
    title: 'governance',
    image: governanceImg,
    descriptionKey: 'assess-data-reliability-with-data-profiler-lineage',
  },
  {
    title: 'data-insight',
    image: insightImg,
    descriptionKey: 'fosters-collaboration-among-producers-and-consumers',
  },
  {
    title: 'collaboration',
    image: collaborationImg,
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
