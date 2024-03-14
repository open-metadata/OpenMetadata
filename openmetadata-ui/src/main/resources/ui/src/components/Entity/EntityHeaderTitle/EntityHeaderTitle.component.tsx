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
import { Badge, Col, Row, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { ReactComponent as IconExternalLink } from '../../../assets/svg/external-link-grey.svg';
import { TEXT_COLOR } from '../../../constants/Color.constants';
import { ROUTES } from '../../../constants/constants';
import { stringToHTML } from '../../../utils/StringsUtils';
import { EntityHeaderTitleProps } from './EntityHeaderTitle.interface';

const EntityHeaderTitle = ({
  icon,
  name,
  displayName,
  link,
  openEntityInNewPage,
  deleted = false,
  serviceName,
  badge,
  isDisabled,
  className,
  color,
  showName = true,
}: EntityHeaderTitleProps) => {
  const { t } = useTranslation();
  const location = useLocation();

  const isTourRoute = useMemo(
    () => location.pathname.includes(ROUTES.TOUR),
    [location.pathname]
  );

  const content = (
    <Row
      align="middle"
      className={className}
      data-testid={`${serviceName}-${name}`}
      gutter={12}
      wrap={false}>
      <Col flex="48px">{icon}</Col>
      <Col className={deleted || badge ? 'w-max-full-140' : ''}>
        {/* If we do not have displayName name only be shown in the bold from the below code */}
        {!isEmpty(displayName) && showName ? (
          <Typography.Text
            className="m-b-0 d-block text-grey-muted"
            data-testid="entity-header-name">
            {stringToHTML(name)}
          </Typography.Text>
        ) : null}

        {/* It will render displayName fallback to name */}
        <Typography.Text
          className="m-b-0 d-block entity-header-display-name text-lg font-semibold"
          data-testid="entity-header-display-name"
          ellipsis={{ tooltip: true }}
          style={{ color: color ?? TEXT_COLOR }}>
          {stringToHTML(displayName || name)}
          {openEntityInNewPage && (
            <IconExternalLink
              className="anticon vertical-baseline m-l-xss"
              height={14}
              width={14}
            />
          )}
        </Typography.Text>
      </Col>
      {isDisabled && (
        <Badge
          className="m-l-xs badge-grey"
          count={t('label.disabled')}
          data-testid="disabled"
        />
      )}
      {deleted && (
        <Col className="text-xs" flex="100px">
          <span className="deleted-badge-button" data-testid="deleted-badge">
            <ExclamationCircleFilled className="m-r-xss font-medium text-xs" />
            {t('label.deleted')}
          </span>
        </Col>
      )}
      {badge && <Col>{badge}</Col>}
    </Row>
  );

  return link && !isTourRoute ? (
    <Link
      className="no-underline d-inline-block"
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
