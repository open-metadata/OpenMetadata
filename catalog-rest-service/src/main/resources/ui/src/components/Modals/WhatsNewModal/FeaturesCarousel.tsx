/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

/* eslint-disable max-len */

import { uniqueId } from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import Slider from 'react-slick';

type Props = {
  data: { title: string; description: string; image: string }[];
};

const FeaturesCarousel = ({ data }: Props) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const sliderRef = useRef<typeof Slider | null>(null);

  const settings = {
    dots: true,
    arrows: false,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    initialSlide: 0,
    afterChange: (currentSlide: number) => setCurrentSlide(currentSlide),
  };

  useEffect(() => {
    if (currentSlide > 0 && sliderRef.current) {
      sliderRef.current.slickGoTo(0, true);
      setCurrentSlide(0);
    }
  }, [data]);

  return (
    <>
      <Slider ref={sliderRef} {...settings}>
        {data.map((d) => (
          <div className="tw-pr-2" key={uniqueId()}>
            <p className="tw-text-sm tw-font-medium tw-mb-2">{d.title}</p>
            <p className="tw-text-sm tw-mb-3">{d.description}</p>
            <div className="tw-max-w-3xl">
              <img alt="feature" className="tw-w-full" src={d.image} />
            </div>
          </div>
        ))}
      </Slider>
    </>
  );
};

export default FeaturesCarousel;
