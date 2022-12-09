import { act, render, screen } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { LOGIN_SLIDE } from '../../constants/Login.constants';
import LoginCarousel from './LoginCarousel';

jest.mock('react-slick', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="react-slick">{children}</div>
    ));
});

jest.mock('i18next', () => ({
  t: jest.fn().mockImplementation((key) => key),
}));

describe('Test LoginCarousel component', () => {
  it('LoginCarousel component should render properly', async () => {
    await act(async () => {
      render(<LoginCarousel />, {
        wrapper: MemoryRouter,
      });
    });

    const reactSlick = await screen.findByTestId('react-slick');
    const carouselContainer = await screen.findByTestId('carousel-container');
    const sliderContainer = await screen.findAllByTestId('slider-container');
    const descriptions = await screen.findAllByTestId(
      'carousel-slide-description'
    );

    expect(reactSlick).toBeInTheDocument();
    expect(carouselContainer).toBeInTheDocument();
    expect(sliderContainer.length).toBe(LOGIN_SLIDE.length);
    expect(descriptions.map((d) => d.textContent)).toEqual(
      LOGIN_SLIDE.map((d) => `message.${d.descriptionKey}`)
    );
  });
});
