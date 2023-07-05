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

import { Carousel } from 'antd';
import { uniqueId } from 'lodash';
import React from 'react';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import { FeaturesCarouselProps } from './FeaturesCarousel.interface';

const FeaturesCarousel = ({ data }: FeaturesCarouselProps) => {
  return (
    <div className="feature-carousal-container">
      <Carousel autoplay dots autoplaySpeed={3000} easing="ease-in-out">
        {data.map((d) => (
          <div className="tw-px-1" key={uniqueId()}>
            <p className="tw-text-sm tw-font-medium tw-mb-2">{d.title}</p>
            <div className="tw-text-sm tw-mb-3">
              <RichTextEditorPreviewer
                enableSeeMoreVariant={false}
                markdown={d.description}
              />
            </div>
            <div>
              {d.path ? (
                d.isImage ? (
                  <img alt="feature" className="tw-w-full" src={d.path} />
                ) : (
                  <iframe
                    allowFullScreen
                    className="tw-w-full"
                    frameBorder={0}
                    height={457}
                    src={d.path}
                  />
                )
              ) : null}
            </div>
          </div>
        ))}
      </Carousel>
    </div>
  );
};

export default FeaturesCarousel;
