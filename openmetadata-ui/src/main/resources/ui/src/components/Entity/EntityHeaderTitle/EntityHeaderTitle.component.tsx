/*
 *  Copyright 2023 Collate.
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
import { Col, Row, Typography } from 'antd';
import { ReactComponent as IconExternalLink } from 'assets/svg/external-link-grey.svg';
import React from 'react';
import { Link } from 'react-router-dom';
import { EntityHeaderTitleProps } from './EntityHeaderTitle.interface';

const EntityHeaderTitle = ({
  icon,
  name,
  displayName,
  link,
  openEntityInNewPage,
}: EntityHeaderTitleProps) => {
  return (
    <Row align="middle" gutter={8} wrap={false}>
      <Col>{icon}</Col>
      <Col>
        <div>
          <Typography.Text
            className="m-b-0 d-block tw-text-xs tw-text-grey-muted"
            data-testid="entity-header-name">
            {name}
          </Typography.Text>
          {link ? (
            <Link
              className="m-b-0 d-block entity-header-display-name text-lg font-bold"
              data-testid="entity-header-display-name"
              to={link}>
              <Typography.Text ellipsis={{ tooltip: true }}>
                {displayName ?? name}
              </Typography.Text>
            </Link>
          ) : (
            <Typography.Text
              className="m-b-0 d-block entity-header-display-name text-lg font-bold"
              data-testid="entity-header-display-name"
              ellipsis={{ tooltip: true }}>
              {displayName ?? name}{' '}
              {openEntityInNewPage && (
                <IconExternalLink className="anticon" height={14} />
              )}
            </Typography.Text>
          )}
        </div>
      </Col>
    </Row>
  );
};

export default EntityHeaderTitle;
