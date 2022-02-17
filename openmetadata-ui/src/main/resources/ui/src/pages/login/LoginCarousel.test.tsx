import { findAllByTestId, findByTestId, render } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { LOGIN_SLIDE } from '../../constants/login.const';
import LoginCarousel from './LoginCarousel';

jest.mock('react-slick', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="react-slick">{children}</div>
    ));
});

describe('Test LoginCarousel component', () => {
  it('LoginCarousel component should render properly', async () => {
    const { container } = render(<LoginCarousel />, {
      wrapper: MemoryRouter,
    });

    const reactSlick = await findByTestId(container, 'react-slick');
    const carouselContainer = await findByTestId(
      container,
      'carousel-container'
    );
    const sliderContainer = await findAllByTestId(
      container,
      'slider-container'
    );
    const descriptions = await findAllByTestId(
      container,
      'carousel-slide-description'
    );

    expect(reactSlick).toBeInTheDocument();
    expect(carouselContainer).toBeInTheDocument();
    expect(sliderContainer.length).toBe(LOGIN_SLIDE.length);
    expect(descriptions.map((d) => d.textContent)).toEqual(
      LOGIN_SLIDE.map((d) => d.description)
    );
  });
});
