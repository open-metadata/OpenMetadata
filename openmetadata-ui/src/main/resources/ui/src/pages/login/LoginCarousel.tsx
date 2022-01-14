import { uniqueId } from 'lodash';
import React from 'react';
import Slider from 'react-slick';
import { LOGIN_SLIDE } from '../../constants/login.const';

const LoginCarousel = () => {
  const settings = {
    dots: true,
    dotsClass: 'login-slider slick-dots',
    arrows: false,
    infinite: true,
    speed: 200,
    slidesToShow: 1,
    slidesToScroll: 1,
  };

  return (
    <div style={{ width: '633px' }}>
      <Slider {...settings}>
        {LOGIN_SLIDE.map((data) => (
          <div key={uniqueId()}>
            <div>
              <img alt="slider" className="tw-w-full" src={data.image} />
            </div>
            <div className="tw-mt-24 tw-mb-11">
              <p className="tw-text-center tw-w-5/6 tw-mx-auto tw-font-medium tw-text-white tw-text-xl">
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
