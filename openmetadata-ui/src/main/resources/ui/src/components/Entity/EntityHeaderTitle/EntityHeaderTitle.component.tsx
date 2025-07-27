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
import Icon, { ExclamationCircleFilled } from '@ant-design/icons';
import { Badge, Button, Col, Row, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as ShareIcon } from '../../../assets/svg/copy-right.svg';
import { ReactComponent as IconExternalLink } from '../../../assets/svg/external-link-grey.svg';
import { ReactComponent as StarFilledIcon } from '../../../assets/svg/ic-star-filled.svg';
import { ROUTES } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import { stringToHTML } from '../../../utils/StringsUtils';
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
  showName = true,
  showOnlyDisplayName = false,
  excludeEntityService,
  isFollowing,
  isFollowingLoading,
  handleFollowingClick,
  entityType,
  nameClassName = '',
  displayNameClassName = '',
  isCustomizedView = false,
}: EntityHeaderTitleProps) => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const [copyTooltip, setCopyTooltip] = useState<string>();
  const { onCopyToClipBoard } = useClipboard(window.location.href);

  const handleShareButtonClick = async () => {
    await onCopyToClipBoard();
    setCopyTooltip(t('message.link-copy-to-clipboard'));
    setTimeout(() => setCopyTooltip(''), 2000);
  };

  const isTourRoute = useMemo(
    () => location.pathname.includes(ROUTES.TOUR),
    [location.pathname]
  );

  const formattedEntityType = useMemo(
    () => entityUtilClassBase.getFormattedEntityType(entityType as EntityType),
    [entityType]
  );

  const entityName = useMemo(
    () =>
      stringToHTML(
        showOnlyDisplayName
          ? getEntityName({
              displayName,
              name,
            })
          : name
      ),
    [showOnlyDisplayName, displayName, name]
  );

  const badges = useMemo(
    () => (
      <>
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
      </>
    ),
    [isDisabled, deleted, badge]
  );

  const content = (
    <Row
      align="middle"
      className={classNames('entity-header-title', className)}
      data-testid={`${serviceName}-${name}`}
      gutter={12}
      wrap={false}>
      {icon && <Col className="flex-center">{icon}</Col>}
      <Col
        className={classNames(
          'd-flex flex-col gap-1 w-min-0 entity-header-container',
          {
            'w-max-full-200': deleted || badge,
          }
        )}>
        {/* If we do not have displayName name only be shown in the bold from the below code */}
        {!isEmpty(displayName) && showName ? (
          <div className="d-flex items-center gap-2">
            <Tooltip
              placement="bottom"
              title={stringToHTML(displayName ?? name)}>
              <Typography.Text
                ellipsis
                className={classNames(
                  'entity-header-name',
                  nameClassName,
                  'm-b-0 d-block display-xs font-semibold'
                )}
                data-testid="entity-header-display-name">
                {stringToHTML(displayName ?? name)}
              </Typography.Text>
            </Tooltip>
            {badges}
          </div>
        ) : null}

        <div
          className="d-flex gap-3 items-center"
          data-testid="entity-header-title">
          <Tooltip placement="bottom" title={entityName}>
            <Typography.Text
              ellipsis
              className={classNames(displayNameClassName, 'm-b-0', {
                'display-xs entity-header-name font-semibold': !displayName,
                'text-md entity-header-display-name font-medium': displayName,
              })}
              data-testid="entity-header-name">
              {entityName}
              {openEntityInNewPage && (
                <IconExternalLink
                  className="anticon vertical-middle m-l-xss"
                  height={14}
                  width={14}
                />
              )}
            </Typography.Text>
          </Tooltip>

          <Tooltip
            placement="topRight"
            title={
              copyTooltip ??
              t('label.copy-item', { item: t('label.url-uppercase') })
            }>
            <Button
              className="remove-button-default-styling copy-button flex-center p-xss "
              icon={<Icon component={ShareIcon} />}
              onClick={handleShareButtonClick}
            />
          </Tooltip>
          {!excludeEntityService &&
            !deleted &&
            !isCustomizedView &&
            handleFollowingClick && (
              <Tooltip
                title={t('label.field-entity', {
                  field: t(`label.${isFollowing ? 'un-follow' : 'follow'}`),
                  entity: formattedEntityType,
                })}>
                <Button
                  className="entity-follow-button flex-center gap-1 text-sm "
                  data-testid="entity-follow-button"
                  disabled={deleted}
                  icon={<Icon component={StarFilledIcon} />}
                  loading={isFollowingLoading}
                  onClick={handleFollowingClick}>
                  <Typography.Text>
                    {t(`label.${isFollowing ? 'un-follow' : 'follow'}`)}
                  </Typography.Text>
                </Button>
              </Tooltip>
            )}
        </div>
      </Col>

      {isEmpty(displayName) ? badges : null}
    </Row>
  );

  return link && !isTourRoute ? (
    <Link
      className="no-underline d-inline-block w-max-full entity-header-title-link"
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
