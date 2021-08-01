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
