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
import { ExclamationCircleFilled } from '@ant-design/icons';
import { Col, Row, Typography } from 'antd';
import { ReactComponent as IconExternalLink } from 'assets/svg/external-link-grey.svg';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityHeaderTitleProps } from './EntityHeaderTitle.interface';

const EntityHeaderTitle = ({
  icon,
  name,
  displayName,
  link,
  openEntityInNewPage,
  deleted = false,
  serviceName,
}: EntityHeaderTitleProps) => {
  const { t } = useTranslation();

  const content = (
    <Row
      align="middle"
      data-testid={`${serviceName}-${name}`}
      gutter={8}
      wrap={false}>
      <Col>{icon}</Col>
      <Col>
        <div>
          <Typography.Text
            className="m-b-0 d-block tw-text-xs tw-text-grey-muted"
            data-testid="entity-header-name">
            {name}
          </Typography.Text>

          <Typography.Text
            className="m-b-0 d-block entity-header-display-name text-lg font-bold"
            data-testid="entity-header-display-name"
            ellipsis={{ tooltip: true }}>
            {displayName ?? name}
            {openEntityInNewPage && (
              <IconExternalLink
                className="anticon vertical-baseline m-l-xss"
                height={14}
                width={14}
              />
            )}
          </Typography.Text>
        </div>
      </Col>
      {deleted && (
        <Col className="self-end text-xs">
          <div className="deleted-badge-button" data-testid="deleted-badge">
            <ExclamationCircleFilled className="m-r-xss font-medium text-xs" />
            {t('label.deleted')}
          </div>
        </Col>
      )}
    </Row>
  );

  return link ? (
    <Link
      className="tw-no-underline"
      data-testid="entity-link"
      target={openEntityInNewPage ? '_blank' : '_self'}
      to={link}>
      {content}
    </Link>
  ) : (
    content
  );
};

export default EntityHeaderTitle;
