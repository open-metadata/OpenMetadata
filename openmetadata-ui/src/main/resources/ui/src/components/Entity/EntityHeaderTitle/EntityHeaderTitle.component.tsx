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
import {
  Badge,
  Button,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
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
import { renderHighlightedText } from '../../../utils/EntitySearchUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import './entity-header-title.less';
import { EntityHeaderTitleProps } from './EntityHeaderTitle.interface';

// Extracted so this ternary doesn't add to the cyclomatic complexity of the
// functions that call it (it's evaluated twice per render for the follow
// button's tooltip and its label).
// Brand pill: utility tokens resolve to the previous light values
// (brand-50 fill, brand-700 text) and flip in dark.
const FOLLOW_BUTTON_CLASS_NAME = classNames(
  'entity-follow-button tw:h-auto tw:gap-1 tw:rounded-2xl tw:px-3 tw:py-1',
  'tw:bg-utility-brand-50 tw:text-sm tw:font-medium tw:text-utility-brand-700',
  'tw:hover:bg-utility-brand-50 tw:hover:text-utility-brand-700 tw:*:data-text:px-0'
);

const getFollowLabelKey = (isFollowing?: boolean) =>
  `label.${isFollowing ? 'un-follow' : 'follow'}`;

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
      renderHighlightedText(
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
            className="m-l-xs"
            color="gray"
            data-testid="disabled"
            size="sm"
            type="pill-color">
            {t('label.disabled')}
          </Badge>
        )}
        {deleted && (
          <div className="text-xs tw:flex-[0_0_100px]">
            <span className="deleted-badge-button" data-testid="deleted-badge">
              <ExclamationCircleFilled className="m-r-xss font-medium text-xs" />
              {t('label.deleted')}
            </span>
          </div>
        )}
        {badge && <div>{badge}</div>}
      </>
    ),
    [isDisabled, deleted, badge]
  );

  const canShowFollowButton = useMemo(
    () => !excludeEntityService && !deleted && !isCustomizedView,
    [excludeEntityService, deleted, isCustomizedView]
  );

  // Each render* helper below is its own function scope, so its internal
  // branches don't add to EntityHeaderTitle's own cyclomatic complexity.
  // Pure extraction of the JSX that used to live inline — same conditions,
  // same order, same output.
  const renderDisplayNameHeader = () => {
    if (isEmpty(displayName) || !showName) {
      return null;
    }

    return (
      <div className="d-flex items-center gap-2">
        <Tooltip
          placement="bottom"
          title={renderHighlightedText(displayName ?? name)}
          triggerClassName="tw:block tw:min-w-0">
          <Typography
            ellipsis
            className={classNames(
              'entity-header-name tw:min-w-0 tw:text-primary',
              nameClassName,
              'm-b-0 d-block display-xs font-semibold'
            )}
            data-testid="entity-header-display-name">
            {renderHighlightedText(displayName ?? name)}
          </Typography>
        </Tooltip>
        {badges}
        {suffix}
      </div>
    );
  };

  const renderFollowButton = () => {
    if (!canShowFollowButton || !handleFollowingClick) {
      return null;
    }

    return (
      <Tooltip
        title={t('label.field-entity', {
          field: t(getFollowLabelKey(isFollowing)),
          entity: formattedEntityType,
        })}>
        <Button
          showTextWhileLoading
          className={FOLLOW_BUTTON_CLASS_NAME}
          color="tertiary"
          data-testid="entity-follow-button"
          iconLeading={
            <StarFilledIcon className="tw:size-3.5 tw:text-utility-brand-600" />
          }
          isDisabled={deleted}
          isLoading={isFollowingLoading}
          size="sm"
          onClick={handleFollowingClick}>
          {t(getFollowLabelKey(isFollowing))}
        </Button>
      </Tooltip>
    );
  };

  const renderContent = () => (
    <div
      className={classNames(
        'entity-header-title tw:flex tw:flex-nowrap tw:items-center tw:gap-3',
        className
      )}
      data-testid={`${serviceName}-${name}`}>
      {icon && <div className="flex-center">{icon}</div>}
      <div
        className={classNames(
          'd-flex flex-col gap-1 w-min-0 entity-header-container tw:relative tw:max-w-full',
          {
            'w-max-full-200': deleted || badge,
          }
        )}>
        {/* If we do not have displayName name only be shown in the bold from the below code */}
        {renderDisplayNameHeader()}

        <div
          className="d-flex gap-3 items-center"
          data-testid="entity-header-title">
          <Tooltip
            placement="bottom"
            title={entityName}
            triggerClassName="tw:block tw:min-w-0">
            <Typography
              ellipsis
              className={classNames(displayNameClassName, 'm-b-0 tw:min-w-0', {
                'display-xs entity-header-name font-semibold tw:block tw:text-primary':
                  !displayName,
                'text-md entity-header-display-name font-medium tw:text-secondary':
                  displayName,
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
            </Typography>
          </Tooltip>

          <Tooltip
            placement="top right"
            title={
              copyTooltip ??
              t('label.copy-item', { item: t('label.url-uppercase') })
            }>
            <Button
              aria-label={t('label.copy-item', {
                item: t('label.url-uppercase'),
              })}
              className="copy-button tw:size-[22px] tw:rounded-md tw:border tw:border-solid tw:border-utility-gray-blue-100 tw:bg-surface tw:p-1 tw:hover:bg-surface"
              color="tertiary"
              iconLeading={<ShareIcon className="tw:size-3.5" />}
              size="xs"
              onClick={handleShareButtonClick}
            />
          </Tooltip>
          {(isEmpty(displayName) || !showName) && suffix}
          {renderFollowButton()}
        </div>
      </div>

      {isEmpty(displayName) ? badges : null}
    </div>
  );

  return link && !isTourRoute ? (
    <Link
      className="no-underline d-inline-block w-max-full entity-header-title-link"
      data-testid="entity-link"
      target={openEntityInNewPage ? '_blank' : '_self'}
      to={link}
      onClick={(e) => e.stopPropagation()}>
      {renderContent()}
    </Link>
  ) : (
    renderContent()
  );
};

export default EntityHeaderTitle;
