/*
 *  Copyright 2025 Collate.
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

import { Breadcrumb, Col, Row } from 'antd';
import classNames from 'classnames';
import { FC, Fragment, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as HomeIcon } from '../../assets/svg/ic-home.svg';
import { useAlertStore } from '../../hooks/useAlertStore';
import AlertBar from '../AlertBar/AlertBar';
import DocumentTitle from '../common/DocumentTitle/DocumentTitle';
import './page-layout-v2.less';
import { PageLayoutV2Props } from './PageLayoutV2.interface';

const PageLayoutV2: FC<PageLayoutV2Props> = ({
  children,
  pageTitle,
  breadcrumbs = [],
  header,
  className,
  style,
}) => {
  const { alert } = useAlertStore();

  const breadcrumbItems = useMemo(() => {
    return breadcrumbs.map((item, index) => (
      <Breadcrumb.Item key={index}>
        {index === 0 ? (
          <Link to="/">
            <HomeIcon
              style={{ width: 18, height: 18, verticalAlign: 'middle' }}
            />
          </Link>
        ) : item.path ? (
          <Link to={item.path}>{item.label}</Link>
        ) : (
          item.label
        )}
      </Breadcrumb.Item>
    ));
  }, [breadcrumbs]);

  return (
    <Fragment>
      <DocumentTitle title={pageTitle} />
      <div
        className={classNames('page-layout-v2', className)}
        data-testid="page-layout-v2"
        style={style}>
        {/* Alert Bar */}
        {alert && (
          <Row>
            <Col id="page-alert" span={24}>
              <AlertBar message={alert.message} type={alert.type} />
            </Col>
          </Row>
        )}

        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <Row className="page-layout-v2-breadcrumbs">
            <Col span={24}>
              <Breadcrumb separator=">">{breadcrumbItems}</Breadcrumb>
            </Col>
          </Row>
        )}

        <div className="page-layout-v2-content">
          {/* Header */}
          {header && <div className="page-layout-v2-header">{header}</div>}

          {/* Page Content */}
          <div className="page-layout-v2-page-content">{children}</div>
        </div>
      </div>
    </Fragment>
  );
};

export default PageLayoutV2;
