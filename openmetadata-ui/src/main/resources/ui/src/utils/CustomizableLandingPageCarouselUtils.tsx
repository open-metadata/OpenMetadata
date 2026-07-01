/*
 *  Copyright 2026 Collate.
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

import Icon from '@ant-design/icons';
import type { DOMAttributes } from 'react';
import { ReactComponent as ArrowRightIcon } from '../assets/svg/arrow-right.svg';

// Keep carousel-only icons outside CustomizableLandingPageUtils so the header
// does not import the widget registry before the first dashboard paint.
export const CustomNextArrow = (props: DOMAttributes<HTMLDivElement>) => (
  <Icon
    className="custom-arrow right-arrow"
    component={ArrowRightIcon}
    onClick={props.onClick}
  />
);

export const CustomPrevArrow = (props: DOMAttributes<HTMLDivElement>) => (
  <Icon
    className="custom-arrow left-arrow"
    component={ArrowRightIcon}
    onClick={props.onClick}
  />
);
