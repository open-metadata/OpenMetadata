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
import { Breadcrumb } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import { isDashboard } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

const breadcrumbNameMap = {
  '/my-data': 'My Data',
  '/reports': 'Reports',
  '/explore': 'Explore',
  '/workflows': 'Workflows',
  '/sql-builder': 'SQL Builder',
  '/teams': 'Teams',
  '/settings': 'Settings',
  '/store': 'Store',
  '/404': 'Page not Found',
  '/feeds': 'Feeds',
  '/dummy': 'Dummy',
};

const BreadcrumbsComponent = () => {
  const location = useLocation();
  const pathNames = location.pathname.split('/').filter((x) => x);
  if (isDashboard(location.pathname)) {
    return null;
  }

  return (
    <div className="search-wrapper">
      <Breadcrumb>
        <Breadcrumb.Item href="/">
          <SVGIcons
            alt="Home"
            height={18}
            icon={Icons.HOME}
            style={{ verticalAlign: 'sub' }}
          />
        </Breadcrumb.Item>
        {pathNames.map((path, index) => {
          const last = index === pathNames.length - 1;
          const to = `/${pathNames.slice(0, index + 1).join('/')}`;

          return last ? (
            <Breadcrumb.Item key={to}>
              {breadcrumbNameMap[to] ? breadcrumbNameMap[to] : path}
            </Breadcrumb.Item>
          ) : (
            <Breadcrumb.Item href={to} key={to}>
              {breadcrumbNameMap[to]}
            </Breadcrumb.Item>
          );
        })}
      </Breadcrumb>
    </div>
  );
};

export default BreadcrumbsComponent;
