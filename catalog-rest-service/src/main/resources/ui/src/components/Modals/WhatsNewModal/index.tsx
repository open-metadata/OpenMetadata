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
import React, { FunctionComponent, useState } from 'react';
import ChangeLogs from './ChangeLogs';
import FeaturesCarousel from './FeaturesCarousel';
import { LATEST_VERSION_ID, WHATS_NEW } from './whatsNewData';
// import { Button } from '../../buttons/Button/Button';

type Props = {
  header: string;
  onCancel: () => void;
};

type ToggleType = 'features' | 'change-log';

export const WhatsNewModal: FunctionComponent<Props> = ({
  header,
  onCancel,
}: Props) => {
  const [activeKey, setActiveKey] = useState(LATEST_VERSION_ID);
  const [checkedValue, setCheckedValue] = useState<ToggleType>('features');

  const getToggleButtonClasses = (type: string): string => {
    return (
      'tw-flex-1 tw-text-primary tw-font-medium tw-border tw-border-transparent tw-rounded tw-py-1 tw-px-2 focus:tw-outline-none' +
      (type === checkedValue ? ' tw-bg-primary-hover-lite tw-border-main' : '')
    );
  };

  const handleToggleChange = (type: ToggleType) => {
    setCheckedValue(type);
  };

  return (
    <dialog className="tw-modal">
      <div className="tw-modal-backdrop" />
      <div className="tw-modal-container">
        <div className="tw-modal-header">
          <p className="tw-modal-title">{header}</p>

          <div className="tw-flex">
            <svg
              className="tw-w-6 tw-h-6 tw-ml-1 tw-cursor-pointer"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              onClick={onCancel}>
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
          className="tw-modal-body tw-pt-0 tw-pb-1 tw-overflow-x-hidden"
          style={{ height: '550px' }}>
          {/* body */}
          <div className="tw-flex tw-w-auto tw-h-full">
            <div className="tw-w-2/12 tw-border-r-2 tw-pr-6 tw-py-4">
              <div className="tw-mb-2.5 tw-flex tw-justify-end">
                <button
                  className="tw-border tw-rounded-md tw-border-success tw-text-success tw-px-1.5 tw-py-1 tw-text-xs"
                  onClick={() => setActiveKey(LATEST_VERSION_ID)}>
                  Latest Release
                </button>
              </div>
              <div className="tw-flex tw-flex-col-reverse">
                {WHATS_NEW.map(({ version, id }) => (
                  <div
                    className="tw-flex tw-items-center tw-justify-end tw-mb-2.5"
                    key={id}>
                    <svg
                      fill="none"
                      height="1em"
                      viewBox="0 0 13 6"
                      width="1em"
                      xmlns="http://www.w3.org/2000/svg">
                      <path
                        clipRule="evenodd"
                        d="M7.878 3.002a1.876 1.876 0 11-3.751 0 1.876 1.876 0 013.751 0zm1.073.562a3.003 3.003 0 01-5.897 0H.563a.563.563 0 010-1.125h2.49a3.002 3.002 0 015.898 0h2.491a.563.563 0 010 1.125H8.951z"
                        fill={activeKey === id ? '#7147E8' : '#6B7280'}
                        fillRule="evenodd"
                      />
                    </svg>
                    <button
                      className={classNames(
                        'tw-ml-1',
                        activeKey === id ? 'tw-text-primary' : null
                      )}
                      onClick={() => setActiveKey(id)}>
                      {version}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="tw-pt-4 tw-pl-10 tw-w-10/12">
              <div className="tw-flex tw-justify-between tw-items-center tw-pb-3">
                <div>
                  <p className="tw-text-base tw-font-medium">
                    {WHATS_NEW[activeKey].version}
                  </p>
                  <p className="tw-text-grey-muted tw-text-xs">
                    {WHATS_NEW[activeKey].description}
                  </p>
                </div>
                <div>
                  <div
                    className="tw-w-60 tw-inline-flex tw-border tw-border-main
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
                  <FeaturesCarousel data={WHATS_NEW[activeKey].features} />
                )}
                {checkedValue === 'change-log' && <ChangeLogs />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
};
