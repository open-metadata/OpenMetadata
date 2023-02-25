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

import classNames from 'classnames';
import { camelCase, isNil } from 'lodash';
import React from 'react';
import { getCountBadge } from '../../../utils/CommonUtils';

export type Tab = {
  name: string;
  icon?: {
    alt: string;
    name: string;
    title: string;
    selectedName: string;
  };
  isProtected: boolean;
  isHidden?: boolean;
  protectedState?: boolean;
  count?: number;
  position: number;
};
type Props = {
  activeTab: number;
  setActiveTab?: (value: number) => void;
  tabs: Array<Tab>;
  className?: string;
  rightPosButton?: JSX.Element;
};
const TabsPane = ({
  activeTab,
  setActiveTab,
  tabs,
  className = '',
  rightPosButton,
}: Props) => {
  const getTabClasses = (tab: number, activeTab: number) => {
    return (
      'tw-gh-tabs tw-px-0 tw-pt-2 tw-mr-8' +
      (activeTab === tab ? ' active' : '')
    );
  };

  return (
    <div className={classNames('tw-bg-transparent', className)}>
      <nav
        className="tw-flex tw-items-center tw-justify-between tw-gh-tabs-container"
        data-testid="tabs"
        id="tabs">
        <div className="tw-flex tw-flex-grow">
          {tabs.map((tab) =>
            !tab.isHidden ? (
              <button
                className={getTabClasses(tab.position, activeTab)}
                data-testid={tab.name}
                id={camelCase(tab.name)}
                key={tab.position}
                onClick={() => setActiveTab?.(tab.position)}>
                {tab.name}
                {!isNil(tab.count)
                  ? getCountBadge(tab.count, '', tab.position === activeTab)
                  : null}
              </button>
            ) : null
          )}
        </div>
        {rightPosButton}
      </nav>
    </div>
  );
};

export default TabsPane;
