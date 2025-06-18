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
import { Col, Grid, Layout, Row } from 'antd';
import { Content } from 'antd/lib/layout/layout';
import classNames from 'classnames';
import { ReactNode } from 'react';
import LoginCarousel from '../../../pages/LoginPage/LoginCarousel';
import DocumentTitle from '../../common/DocumentTitle/DocumentTitle';
import './carousel-layout.less';

export const CarouselLayout = ({
  pageTitle,
  children,
  carouselClassName,
}: {
  pageTitle: string;
  children: ReactNode;
  carouselClassName?: string;
}) => {
  const { xl } = Grid.useBreakpoint();

  return (
    <Layout>
      <DocumentTitle title={pageTitle} />
      <Content className="p-md">
        <Row data-testid="signin-page" gutter={[48, 0]} wrap={false}>
          <Col className="carousel-left-side-container" span={xl ? 10 : 24}>
            {children}
          </Col>
          {xl && (
            <Col span={14}>
              <div
                className={classNames(
                  'form-carousel-container',
                  carouselClassName
                )}>
                <LoginCarousel />
              </div>
            </Col>
          )}
        </Row>
      </Content>
    </Layout>
  );
};
