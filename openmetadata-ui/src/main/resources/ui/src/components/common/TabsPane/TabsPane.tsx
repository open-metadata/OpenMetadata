/*
 *  Copyright 2021 Collate
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
import { isNil, lowerCase } from 'lodash';
import React from 'react';
import { TITLE_FOR_NON_OWNER_ACTION } from '../../../constants/constants';
import { getCountBadge } from '../../../utils/CommonUtils';
import SVGIcons from '../../../utils/SvgUtils';
import NonAdminAction from '../non-admin-action/NonAdminAction';
type Tab = {
  name: string;
  icon: {
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
};
const TabsPane = ({ activeTab, setActiveTab, tabs, className = '' }: Props) => {
  const getTabClasses = (tab: number, activeTab: number) => {
    return 'tw-gh-tabs' + (activeTab === tab ? ' active' : '');
  };

  return (
    <div className={classNames('tw-bg-transparent tw--mx-6', className)}>
      <nav
        className="tw-flex tw-flex-row tw-gh-tabs-container tw-px-7"
        id="tabs">
        {tabs.map((tab) =>
          !tab.isHidden ? (
            tab.isProtected ? (
              <NonAdminAction
                isOwner={tab.protectedState}
                key={tab.position}
                title={TITLE_FOR_NON_OWNER_ACTION}>
                <button
                  className={getTabClasses(tab.position, activeTab)}
                  data-testid="tab"
                  id={lowerCase(tab.name)}
                  onClick={() => setActiveTab?.(tab.position)}>
                  <SVGIcons
                    alt={tab.icon.alt}
                    icon={
                      tab.position === activeTab
                        ? tab.icon.selectedName
                        : tab.icon.name
                    }
                    title={tab.icon.title}
                    width="16"
                  />{' '}
                  {tab.name}
                </button>
              </NonAdminAction>
            ) : (
              <button
                className={getTabClasses(tab.position, activeTab)}
                data-testid="tab"
                id={lowerCase(tab.name)}
                key={tab.position}
                onClick={() => setActiveTab?.(tab.position)}>
                <SVGIcons
                  alt={tab.icon.alt}
                  icon={
                    tab.position === activeTab
                      ? tab.icon.selectedName
                      : tab.icon.name
                  }
                  title={tab.icon.title}
                  width="16"
                />{' '}
                {tab.name}
                {!isNil(tab.count)
                  ? getCountBadge(tab.count, '', tab.position === activeTab)
                  : null}
              </button>
            )
          ) : null
        )}
      </nav>
    </div>
  );
};

export default TabsPane;
