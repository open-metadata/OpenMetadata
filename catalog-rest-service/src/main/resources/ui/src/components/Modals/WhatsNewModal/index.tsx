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

import classNames from 'classnames';
import { CookieStorage } from 'cookie-storage';
import React, { FunctionComponent, useState } from 'react';
import ChangeLogs from './ChangeLogs';
import FeaturesCarousel from './FeaturesCarousel';
import { COOKIE_VERSION, LATEST_VERSION_ID, WHATS_NEW } from './whatsNewData';
import { getReleaseVersionExpiry } from './WhatsNewModal.util';
// import { Button } from '../../buttons/Button/Button';

type Props = {
  header: string;
  onCancel: () => void;
};

type ToggleType = 'features' | 'change-log';

const iconString = `M7.878 3.002a1.876 1.876 0 11-3.751 0 1.876 1.876 0 013.751 0zm1.073.562a3.003
 3.003 0 01-5.897 0H.563a.563.563 0 010-1.125h2.49a3.002 3.002 0 015.898 0h2.491a.563.563 0 010 1.125H8.951z`;

const cookieStorage = new CookieStorage();

export const WhatsNewModal: FunctionComponent<Props> = ({
  header,
  onCancel,
}: Props) => {
  const [activeData, setActiveData] = useState(WHATS_NEW[LATEST_VERSION_ID]);
  const [checkedValue, setCheckedValue] = useState<ToggleType>('features');

  const getToggleButtonClasses = (type: string): string => {
    return (
      'tw-flex-1 tw-font-medium tw-border tw-border-transparent tw-rounded tw-py-1 tw-px-2 focus:tw-outline-none' +
      (type === checkedValue
        ? ' tw-bg-primary tw-border-primary tw-text-white'
        : ' tw-text-primary ')
    );
  };

  const handleToggleChange = (type: ToggleType) => {
    setCheckedValue(type);
  };

  const handleCancel = () => {
    cookieStorage.setItem(COOKIE_VERSION, 'true', {
      expires: getReleaseVersionExpiry(),
    });
    onCancel();
  };

  return (
    <dialog className="tw-modal">
      <div className="tw-modal-backdrop" />
      <div
        className="tw-modal-container tw-pb-0"
        style={{ maxWidth: '1050px' }}>
        <div className="tw-modal-header">
          <p className="tw-modal-title">{header}</p>

          <div className="tw-flex">
            <svg
              className="tw-w-6 tw-h-6 tw-ml-1 tw-cursor-pointer"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              onClick={handleCancel}>
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
        <div
          className="tw-modal-body tw-p-0 tw-overflow-hidden"
          style={{ height: '720px' }}>
          {/* body */}
          <div className="tw-flex tw-w-auto tw-h-full">
            <div
              className="tw-border-r-2 tw-px-4 tw-py-4 tw-border-separate"
              style={{ width: '14%' }}>
              <div className="tw-flex tw-flex-col-reverse">
                {WHATS_NEW.map((d) => (
                  <div
                    className="tw-flex tw-items-center tw-justify-end tw-mb-2.5"
                    key={d.id}>
                    <svg
                      fill="none"
                      height="1em"
                      viewBox="0 0 13 6"
                      width="1em"
                      xmlns="http://www.w3.org/2000/svg">
                      <path
                        clipRule="evenodd"
                        d={iconString}
                        fill={activeData.id === d.id ? '#7147E8' : '#6B7280'}
                        fillRule="evenodd"
                      />
                    </svg>
                    <button
                      className={classNames(
                        'tw-ml-1',
                        activeData.id === d.id ? 'tw-text-primary' : null
                      )}
                      onClick={() => setActiveData(d)}>
                      {d.version}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="tw-overflow-y-auto" style={{ width: '86%' }}>
              <div className="tw-pt-4 tw-px-10 ">
                <div className="tw-flex tw-justify-between tw-items-center tw-pb-3">
                  <div>
                    <p className="tw-text-base tw-font-medium">
                      {activeData.version}
                    </p>
                    <p className="tw-text-grey-muted tw-text-xs">
                      {activeData.description}
                    </p>
                  </div>
                  <div>
                    <div
                      className="tw-w-60 tw-inline-flex tw-border tw-border-primary
            tw-text-sm tw-rounded-md tw-h-8 tw-bg-white">
                      <button
                        className={getToggleButtonClasses('features')}
                        onClick={() => handleToggleChange('features')}>
                        Features
                      </button>
                      <button
                        className={getToggleButtonClasses('change-log')}
                        onClick={() => {
                          handleToggleChange('change-log');
                        }}>
                        Change Logs
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  {checkedValue === 'features' && (
                    <FeaturesCarousel data={activeData.features} />
                  )}
                  {checkedValue === 'change-log' && (
                    <ChangeLogs data={activeData.changeLogs} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
};
