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

import React from 'react';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

const Onboarding: React.FC = () => {
  const clipPath = {
    clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
  };

  return (
    <div className="tw-flex tw-items-center tw-justify-around tw-mt-28">
      <div className="tw-p-4">
        <h4>3 Steps to get started with OpenMetadata</h4>
        <div className="tw-mt-5">
          <div className="tw-flex tw-gap-4">
            <div>
              <span
                className="tw-mt-1 tw-w-6 tw-h-6 tw-flex tw-items-center tw-justify-center tw-font-medium tw-p-1 tw-text-base tw-bg-green-600 tw-text-white"
                style={clipPath}>
                1
              </span>
            </div>
            <div>
              <p className="tw-text-lg tw-font-medium">
                Lorem ipsum dolor sit amet.
              </p>
              <p>
                Lorem ipsum dolor sit amet consectetur, adipisicing elit.
                Distinctio, illum!
              </p>
              <p>
                Lorem ipsum dolor sit amet consectetur, adipisicing elit.
                Distinctio, illum!
              </p>
            </div>
          </div>

          <div className="tw-flex tw-gap-4 mt-4">
            <div>
              <span
                className="tw-mt-1 tw-w-6 tw-h-6 tw-flex tw-items-center tw-justify-center tw-font-medium tw-p-1 tw-text-base tw-bg-green-600 tw-text-white"
                style={clipPath}>
                2
              </span>
            </div>
            <div>
              <p className="tw-text-lg tw-font-medium">
                Lorem ipsum dolor sit amet.
              </p>
              <p>
                Lorem ipsum dolor sit amet consectetur, adipisicing elit.
                Distinctio, illum!
              </p>
              <p>
                Lorem ipsum dolor sit amet consectetur, adipisicing elit.
                Distinctio, illum!
              </p>
            </div>
          </div>

          <div className="tw-flex tw-gap-4 mt-4">
            <div>
              <span
                className="tw-mt-1 tw-w-6 tw-h-6 tw-flex tw-items-center tw-justify-center tw-font-medium tw-p-1 tw-text-base tw-bg-green-600 tw-text-white"
                style={clipPath}>
                3
              </span>
            </div>
            <div>
              <p className="tw-text-lg tw-font-medium">
                Lorem ipsum dolor sit amet.
              </p>
              <p>
                Lorem ipsum dolor sit amet consectetur, adipisicing elit.
                Distinctio, illum!
              </p>
              <p>
                Lorem ipsum dolor sit amet consectetur, adipisicing elit.
                Distinctio, illum!
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        {/* <img
          alt=""
          className="tw-h-auto tw-w-full tw-filter tw-grayscale tw-opacity-50"
          src={logo}
        /> */}
        <SVGIcons
          alt="OpenMetadata Logo"
          className="tw-h-auto tw-filter tw-grayscale tw-opacity-50"
          icon={Icons.LOGO_SMALL}
          width="350"
        />
      </div>
    </div>
  );
};

export default Onboarding;
