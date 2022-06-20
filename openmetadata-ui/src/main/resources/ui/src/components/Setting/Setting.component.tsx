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

import { Card, Menu } from 'antd';
import type { MenuProps } from 'antd';
import { default as React, useRef } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import RolesPageComponent from '../../pages/RolesPage/RolesPage.component';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import PageLayout from '../containers/PageLayout';
import Loader from '../Loader/Loader';

type MenuItem = Required<MenuProps>['items'][number];

export function getItem(
  label: React.ReactNode,
  key: React.Key,
  icon?: React.ReactNode,
  children?: MenuItem[],
  type?: 'group'
): MenuItem {
  return {
    key,
    icon,
    children,
    label,
    type,
  } as MenuItem;
}

const SettingComponent = () => {
  const location = useLocation();
  const history = useHistory();
  const settingRef = useRef<any>();
  const [leftPanel, setLeftPanel] = React.useState();

  const items: MenuProps['items'] = [
    getItem('Roles', 'sub1', null, leftPanel || []),

    getItem('Services', 'sub2', null, [
      getItem('Option 5', '5'),
      getItem('Option 6', '6'),
      getItem('Submenu', 'sub3', null, [
        getItem('Option 7', '7'),
        getItem('Option 8', '8'),
      ]),
    ]),

    getItem('Navigation Three', 'sub4', null, [
      getItem(<Loader />, '9'),
      getItem('Option 10', '10'),
      getItem('Option 11', '11'),
      getItem('Option 12', '12'),
    ]),
  ];

  React.useEffect(() => {
    setLeftPanel(settingRef.current?.getLeftPanel());
  }, [settingRef.current?.roles]);

  const fetchLeftPanel = () => (
    <div className="omd-card-shadow">
      <Card data-testid="data-summary-container">
        {' '}
        <Menu
          defaultOpenKeys={['sub1']}
          defaultSelectedKeys={['1']}
          items={items}
          mode="inline"
          style={{ width: '100%' }}
          onClick={(val) => {
            console.log(val);

            return;
          }}
        />
      </Card>
    </div>
  );

  return (
    <>
      <PageLayout classes="tw-h-full tw-px-6" leftPanel={fetchLeftPanel()}>
        <div
          className="tw-flex tw-justify-between tw-items-center"
          data-testid="header">
          <div
            className="tw-heading tw-text-link tw-text-base tw--mt-2"
            data-testid="category-name">
            <TitleBreadcrumb
              titleLinks={[{ name: 'test', url: 'test/test/test' }]}
            />
            <RolesPageComponent ref={settingRef} />
          </div>
        </div>
      </PageLayout>
    </>
  );
};

export default SettingComponent;
