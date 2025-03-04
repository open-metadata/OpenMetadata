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
import { Badge, Col, Divider, Row, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconExternalLink } from '../../../assets/svg/external-link-grey.svg';
import { TEXT_COLOR } from '../../../constants/Color.constants';
import { ROUTES } from '../../../constants/constants';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { stringToHTML } from '../../../utils/StringsUtils';
import CertificationTag from '../../common/CertificationTag/CertificationTag';
import './entity-header-title.less';
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
  certification,
  nameClassName = '',
  displayNameClassName = '',
}: EntityHeaderTitleProps) => {
  const { t } = useTranslation();
  const location = useCustomLocation();

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
      {icon && <Col className="flex-center">{icon}</Col>}
      <Col
        className={classNames(
          deleted || badge ? 'w-max-full-140' : 'entity-header-content',
          nameClassName
        )}>
        {/* If we do not have displayName name only be shown in the bold from the below code */}
        {!isEmpty(displayName) && showName ? (
          <Typography.Text
            className="entity-header-name"
            data-testid="entity-header-name"
            ellipsis={{ tooltip: true }}>
            {stringToHTML(name)}
          </Typography.Text>
        ) : null}

        {/* It will render displayName fallback to name */}
        <Typography.Text
          className={classNames(
            'entity-header-display-name',
            displayNameClassName
          )}
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
      {certification && (
        <Col className="text-xs">
          <div className="d-flex items-center">
            <Divider className="m-x-xs h-6 m-r-sm" type="vertical" />
            <CertificationTag certification={certification} />
          </div>
        </Col>
      )}
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
      className="no-underline d-inline-block w-full"
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
