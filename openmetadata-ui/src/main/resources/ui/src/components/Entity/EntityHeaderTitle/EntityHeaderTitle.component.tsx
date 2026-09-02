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
import { MouseEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as ShareIcon } from '../../../assets/svg/copy-right.svg';
import { ReactComponent as IconExternalLink } from '../../../assets/svg/external-link-grey.svg';
import { ReactComponent as StarFilledIcon } from '../../../assets/svg/ic-star-filled.svg';
import { ROUTES } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { getEntityName } from '../../../utils/EntityNameUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { stringToHTML } from '../../../utils/StringUtils';
import './entity-header-title.less';
import { EntityHeaderTitleProps } from './EntityHeaderTitle.interface';

interface NameHeaderBlockProps {
  badges: JSX.Element;
  displayName?: string;
  name: string;
  nameClassName: string;
  suffix?: EntityHeaderTitleProps['suffix'];
}

const NameHeaderBlock = ({
  badges,
  displayName,
  name,
  nameClassName,
  suffix,
}: NameHeaderBlockProps) => (
  <div className="d-flex items-center gap-2">
    <Tooltip placement="bottom" title={stringToHTML(displayName ?? name)}>
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
    {suffix}
  </div>
);

interface FollowButtonProps {
  deleted: boolean;
  formattedEntityType?: string;
  handleFollowingClick?: () => void;
  isFollowing?: boolean;
  isFollowingLoading?: boolean;
  t: ReturnType<typeof useTranslation>['t'];
}

const FollowButton = ({
  deleted,
  formattedEntityType,
  handleFollowingClick,
  isFollowing,
  isFollowingLoading,
  t,
}: FollowButtonProps) => {
  const followLabel = t(`label.${isFollowing ? 'un-follow' : 'follow'}`);

  return (
    <Tooltip
      title={t('label.field-entity', {
        field: followLabel,
        entity: formattedEntityType,
      })}>
      <Button
        className="entity-follow-button flex-center gap-1 text-sm "
        data-testid="entity-follow-button"
        disabled={deleted}
        icon={<Icon component={StarFilledIcon} />}
        loading={isFollowingLoading}
        onClick={handleFollowingClick}>
        <Typography.Text>{followLabel}</Typography.Text>
      </Button>
    </Tooltip>
  );
};

interface HeaderContentFlags {
  showDisplayName: boolean;
  showSuffixInline: boolean;
  showFollowButton: boolean;
  hasBadgeSpace: boolean;
}

function computeHeaderContentFlags(
  displayName: string | undefined,
  showName: boolean,
  deleted: boolean,
  badge: EntityHeaderTitleProps['badge'],
  excludeEntityService: boolean | undefined,
  isCustomizedView: boolean,
  handleFollowingClick: (() => void) | undefined
): HeaderContentFlags {
  return {
    showDisplayName: !isEmpty(displayName) && showName,
    showSuffixInline: isEmpty(displayName) || !showName,
    showFollowButton: Boolean(
      !excludeEntityService &&
        !deleted &&
        !isCustomizedView &&
        handleFollowingClick
    ),
    hasBadgeSpace: Boolean(deleted || badge),
  };
}

interface EntityHeaderContentProps {
  badge?: EntityHeaderTitleProps['badge'];
  badges: JSX.Element;
  className?: string;
  copyTooltip?: string;
  deleted: boolean;
  displayName?: string;
  displayNameClassName: string;
  entityName: string | JSX.Element | JSX.Element[];
  excludeEntityService?: boolean;
  formattedEntityType?: string;
  handleFollowingClick?: () => void;
  handleShareButtonClick: (e: MouseEvent<HTMLElement>) => void;
  icon?: EntityHeaderTitleProps['icon'];
  isCustomizedView: boolean;
  isFollowing?: boolean;
  isFollowingLoading?: boolean;
  name: string;
  nameClassName: string;
  openEntityInNewPage?: boolean;
  serviceName?: string;
  showName: boolean;
  suffix?: EntityHeaderTitleProps['suffix'];
  t: ReturnType<typeof useTranslation>['t'];
}

const EntityHeaderContent = ({
  badge,
  badges,
  className,
  copyTooltip,
  deleted,
  displayName,
  displayNameClassName,
  entityName,
  excludeEntityService,
  formattedEntityType,
  handleFollowingClick,
  handleShareButtonClick,
  icon,
  isCustomizedView,
  isFollowing,
  isFollowingLoading,
  name,
  nameClassName,
  openEntityInNewPage,
  serviceName,
  showName,
  suffix,
  t,
}: EntityHeaderContentProps) => {
  const { showDisplayName, showSuffixInline, showFollowButton, hasBadgeSpace } =
    computeHeaderContentFlags(
      displayName,
      showName,
      deleted,
      badge,
      excludeEntityService,
      isCustomizedView,
      handleFollowingClick
    );

  return (
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
            'w-max-full-200': hasBadgeSpace,
          }
        )}>
        {/* If we do not have displayName name only be shown in the bold from the below code */}
        {showDisplayName && (
          <NameHeaderBlock
            badges={badges}
            displayName={displayName}
            name={name}
            nameClassName={nameClassName}
            suffix={suffix}
          />
        )}

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
          {showSuffixInline && suffix}
          {showFollowButton && (
            <FollowButton
              deleted={deleted}
              formattedEntityType={formattedEntityType}
              handleFollowingClick={handleFollowingClick}
              isFollowing={isFollowing}
              isFollowingLoading={isFollowingLoading}
              t={t}
            />
          )}
        </div>
      </Col>

      {isEmpty(displayName) ? badges : null}
    </Row>
  );
};

const EntityHeaderTitle = ({
  icon,
  name,
  displayName,
  link,
  openEntityInNewPage,
  deleted = false,
  serviceName,
  badge,
  suffix,
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
  entityUrl,
}: EntityHeaderTitleProps) => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const [copyTooltip, setCopyTooltip] = useState<string>();
  const { onCopyToClipBoard } = useClipboard(
    entityUrl ?? globalThis.location.href
  );

  const handleShareButtonClick = async (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
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
    <EntityHeaderContent
      badge={badge}
      badges={badges}
      className={className}
      copyTooltip={copyTooltip}
      deleted={deleted}
      displayName={displayName}
      displayNameClassName={displayNameClassName}
      entityName={entityName}
      excludeEntityService={excludeEntityService}
      formattedEntityType={formattedEntityType}
      handleFollowingClick={handleFollowingClick}
      handleShareButtonClick={handleShareButtonClick}
      icon={icon}
      isCustomizedView={isCustomizedView}
      isFollowing={isFollowing}
      isFollowingLoading={isFollowingLoading}
      name={name}
      nameClassName={nameClassName}
      openEntityInNewPage={openEntityInNewPage}
      serviceName={serviceName}
      showName={showName}
      suffix={suffix}
      t={t}
    />
  );

  return link && !isTourRoute ? (
    <Link
      className="no-underline d-inline-block w-max-full entity-header-title-link"
      data-testid="entity-link"
      target={openEntityInNewPage ? '_blank' : '_self'}
      to={link}
      onClick={(e) => e.stopPropagation()}>
      {content}
    </Link>
  ) : (
    content
  );
};

export default EntityHeaderTitle;
