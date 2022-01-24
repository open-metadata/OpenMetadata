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

import screenShot2 from '../assets/img/ss-explore.png';
import screenShot1 from '../assets/img/ss-landing.png';
import screenShot3 from '../assets/img/ss-table-details.png';
import screenShot4 from '../assets/img/ss-users.png';

export const LOGIN_SLIDE = [
  {
    image: screenShot1,
    description:
      'Centralized Metadata Store, Discover, Collaborate and get your Data Right',
  },
  {
    image: screenShot2,
    description:
      'Centralized Metadata Store, Discover, Collaborate and get your Data Right',
  },
  {
    image: screenShot3,
    description:
      'Centralized Metadata Store, Discover, Collaborate and get your Data Right',
  },
  {
    image: screenShot4,
    description:
      'Centralized Metadata Store, Discover, Collaborate and get your Data Right',
  },
];

export const LOGIN_SLIDER_SETTINGS = {
  arrows: false,
  autoplay: true,
  dots: true,
  dotsClass: 'login-slider slick-dots',
  infinite: true,
  slidesToShow: 1,
  slidesToScroll: 1,
  speed: 500,
};
