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

import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import loginClassBase from '../../constants/LoginClassBase';
import LoginCarousel from './LoginCarousel';

const LOGIN_SLIDE = loginClassBase.getLoginCarouselContent();

describe('Test LoginCarousel component', () => {
  it('renders the carousel container', () => {
    render(<LoginCarousel />);

    expect(screen.queryAllByTestId('slider-container')).toHaveLength(
      LOGIN_SLIDE.length
    );
  });

  it('renders a carousel with the correct number of slides', async () => {
    await act(async () => {
      render(<LoginCarousel />, {
        wrapper: MemoryRouter,
      });
    });

    const sliderContainers = await screen.findAllByTestId('slider-container');

    const slides = sliderContainers.map(
      (slider) => slider.parentElement?.parentElement as HTMLElement
    );

    const slackList = slides.filter(
      (slide) => !slide.classList.contains('slick-cloned')
    );

    expect(slackList).toHaveLength(LOGIN_SLIDE.length);
  });

  it('renders the correct slide description for each slide', async () => {
    await act(async () => {
      render(<LoginCarousel />, {
        wrapper: MemoryRouter,
      });
    });

    const slideDescriptions = await screen.findAllByTestId(
      'carousel-slide-description'
    );
    const descriptions = LOGIN_SLIDE.map((d) => `message.${d.descriptionKey}`);
    slideDescriptions.forEach((description) => {
      expect(
        descriptions.includes(description.textContent as string)
      ).toBeTruthy();
    });
  });
});
