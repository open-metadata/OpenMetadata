import { uniqueId } from 'lodash';
import React from 'react';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick-theme.css';
import 'slick-carousel/slick/slick.css';

type Props = {
  data: { title: string; description: string; image: string }[];
};

const FeaturesCarousel = ({ data }: Props) => {
  const settings = {
    dots: true,
    arrows: false,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
  };

  return (
    <>
      <Slider {...settings}>
        {data.map((d) => (
          <div className="tw-pr-2" key={uniqueId()}>
            <p className="tw-text-sm tw-font-medium tw-mb-2">{d.title}</p>
            <p className="tw-text-sm tw-mb-3">{d.description}</p>
            <div>
              <img alt="feature" src={d.image} />
            </div>
          </div>
        ))}
      </Slider>
    </>
  );
};

export default FeaturesCarousel;
