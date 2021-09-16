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

type CarousalData = {
  title: string;
  description: string;
  isImage: boolean;
  path: string;
};

type Props = {
  data: CarousalData[];
};

const FeaturesCarousel = ({ data }: Props) => {
  const [isDataChange, setIsDataChange] = useState(false);
  const sliderRef = useRef<typeof Slider | null>(null);

  const settings = {
    dots: true,
    arrows: false,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    beforeChange: (current: number) => {
      if (current >= data.length) {
        setIsDataChange(true);
      } else {
        setIsDataChange(false);
      }
    },
    onReInit: () => {
      if (isDataChange) {
        setTimeout(() => {
          sliderRef?.current?.slickGoTo(0);
        }, 200);
      }
    },
  };

  useEffect(() => {
    setIsDataChange(true);
  }, [data]);

  return (
    <Slider ref={sliderRef} {...settings}>
      {data.map((d) => (
        <div className="tw-px-1" key={uniqueId()}>
          <p className="tw-text-sm tw-font-medium tw-mb-2">{d.title}</p>
          <p className="tw-text-sm tw-mb-3">{d.description}</p>
          <div className="tw-max-w-3xl">
            {d.isImage ? (
              <img alt="feature" className="tw-w-full" src={d.path} />
            ) : (
              <iframe
                allowFullScreen
                className="tw-w-full"
                frameBorder={0}
                height={278}
                src={d.path}
              />
            )}
          </div>
        </div>
      ))}
    </Slider>
  );
};

export default FeaturesCarousel;
