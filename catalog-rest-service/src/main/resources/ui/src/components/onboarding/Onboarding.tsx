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

const data = [
  'Look at the popular data assets in your organization.',
  'Data works well when it is owned. Take a look at the data assets that you own and claim ownership.',
  'Follow the datasets that you frequently use to stay informed about it.',
];

const Onboarding: React.FC = () => {
  return (
    <div className="tw-flex tw-items-center tw-justify-around tw-mt-20">
      <div className="tw-p-4" style={{ maxWidth: '700px' }}>
        <div className="tw-mb-6">
          <h4>Welcome to OpenMetadata.</h4>
          <p className="tw-text-lg tw-font-normal">
            A central place to discover and collaborate on all your data.
          </p>
        </div>
        <div className="tw-text-base">
          {data.map((d, i) => (
            <div className="tw-flex tw-items-center tw-gap-4 tw-mb-5" key={i}>
              <div className="tw-flex tw-items-center">
                <span
                  className="tw-w-8 tw-h-8 tw-flex tw-items-center tw-justify-center tw-font-medium tw-p-2 
                  tw-bg-primary-lite tw-text-primary tw-rounded-full">
                  {i + 1}
                </span>
              </div>
              <div>
                <p>{d}</p>
              </div>
            </div>
          ))}
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
