/*
 *  Copyright 2022 Collate.
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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Space } from 'antd';
import Tooltip from 'antd/lib/tooltip';
import classNames from 'classnames';
import { isEmpty, isString, isUndefined, lowerCase, toLower } from 'lodash';
import { ExtraInfo } from 'Models';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconExternalLink } from '../../../assets/svg/external-links.svg';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { ReactComponent as IconInfoSecondary } from '../../../assets/svg/icon-info.svg';
import { ReactComponent as IconTeamsGrey } from '../../../assets/svg/teams-grey.svg';
import { DE_ACTIVE_COLOR, ICON_DIMENSION } from '../../../constants/constants';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getTeamsUser } from '../../../utils/TeamUtils';

import { useApplicationStore } from '../../../hooks/useApplicationStore';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import './entity-summary-details.style.less';
import { RetValContext } from './EntitySummaryDetails.interface';

export interface GetInfoElementsProps {
  data: ExtraInfo;
  tier?: TagLabel;
  currentTier?: string;
  currentOwner?: Dashboard['owners'];
  deleted?: boolean;
  allowTeamOwner?: boolean;
}

const InfoIcon = ({ content }: { content: React.ReactNode }): JSX.Element => (
  <Tooltip title={content}>
    <Icon
      alt="info-secondary"
      component={IconInfoSecondary}
      style={{ fontSize: '12px' }}
    />
  </Tooltip>
);

const getOwnerRetVal = ({
  data,
  displayVal,
  userDetails,
  isEntityDetails,
  isTeamOwner,
  t,
}: RetValContext): JSX.Element => {
  if (!displayVal || displayVal === '--') {
    return (
      <span className="d-flex gap-1 items-center" data-testid="owner-link">
        {t('label.no-entity', { entity: t('label.owner-plural') })}
      </span>
    );
  }

  if (!isString(displayVal)) {
    return <></>;
  }

  return (
    <>
      {!isUndefined(userDetails) && isEntityDetails && (
        <>
          <ProfilePicture
            displayName={userDetails.ownerName}
            name={userDetails.ownerName ?? ''}
            width="24"
          />
          <span data-testid="owner-link">{userDetails.ownerName}</span>
          <span className="m-r-xss d-inline-block text-grey-muted">
            {t('label.pipe-symbol')}
          </span>
        </>
      )}
      {isTeamOwner ? (
        <IconTeamsGrey className="align-middle" height={18} width={18} />
      ) : (
        <ProfilePicture
          displayName={displayVal}
          name={data.profileName ?? ''}
          width={data.avatarWidth ?? '24'}
        />
      )}
    </>
  );
};

const getTierRetVal = ({ displayVal, t }: RetValContext): JSX.Element =>
  !displayVal || displayVal === '--' ? (
    <>{t('label.no-entity', { entity: t('label.tier') })}</>
  ) : (
    <></>
  );

const getUsageRetVal = ({ t }: RetValContext): JSX.Element => (
  <>{`${t('label.usage')} - `}</>
);

const getDomainRetVal = ({ displayVal, t }: RetValContext): JSX.Element =>
  !isEmpty(displayVal) ? (
    <DomainIcon
      className="d-flex"
      color={DE_ACTIVE_COLOR}
      height={16}
      name="folder"
      width={16}
    />
  ) : (
    <span className="d-flex gap-1 items-center" data-testid="owner-link">
      {t('label.no-entity', { entity: t('label.domain-plural') })}
    </span>
  );

const getDefaultRetVal = ({
  data,
  displayVal,
  t,
}: RetValContext): JSX.Element => (
  <>
    {data.key
      ? displayVal
        ? data.showLabel
          ? `${t(`label.${toLower(data.key)}`)} - `
          : null
        : `${t('label.no-entity', {
            entity: t(
              `label.${toLower(
                data.localizationKey ? data.localizationKey : data.key
              )}`
            ),
          })}`
      : null}
  </>
);

const RET_VAL_RESOLVERS: Record<string, (ctx: RetValContext) => JSX.Element> = {
  Owner: getOwnerRetVal,
  Tier: getTierRetVal,
  Usage: getUsageRetVal,
  Domain: getDomainRetVal,
};

const getRetVal = (ctx: RetValContext): JSX.Element => {
  const resolver = ctx.data.key ? RET_VAL_RESOLVERS[ctx.data.key] : undefined;

  return resolver ? resolver(ctx) : getDefaultRetVal(ctx);
};

const getLinkContent = ({
  data,
  displayVal,
  userDetails,
  isEntityDetails,
  t,
}: RetValContext): JSX.Element => (
  <>
    <a
      className={classNames('d-inline-block truncate link-text align-middle', {
        'w-52': (displayVal as string).length > 32,
      })}
      data-testid={`${lowerCase(data.key)}-link`}
      href={data.value as string}
      rel="noopener noreferrer"
      target={data.openInNewTab ? '_blank' : '_self'}
      onClick={(e) => {
        e.stopPropagation();
      }}>
      {displayVal}
      {data.openInNewTab && (
        <>
          &nbsp;
          <Icon component={IconExternalLink} style={ICON_DIMENSION} />
        </>
      )}
    </a>

    {isEntityDetails && !isUndefined(userDetails) ? (
      <InfoIcon
        content={
          displayVal
            ? `${t('message.entity-owned-by-name', {
                entityOwner: displayVal ?? '',
              })}

                ${t('message.and-followed-owned-by-name', {
                  userName: !isUndefined(userDetails)
                    ? userDetails.ownerName
                    : '',
                })}`
            : ''
        }
      />
    ) : null}
  </>
);

const getValueContent = (ctx: RetValContext): JSX.Element => {
  const { data, displayVal, isOwner, isTier } = ctx;

  if (data.isLink) {
    return getLinkContent(ctx);
  }

  if (isOwner) {
    return (
      <div className="d-flex" data-testid="owner-link">
        {displayVal}
      </div>
    );
  }

  if (isTier) {
    return (
      <Space
        className={classNames(
          'd-inline-block truncate link-text align-middle',
          {
            'w-52': (displayVal as string).length > 32,
          }
        )}
        data-testid="tier-name"
        direction="horizontal"
        title={displayVal as string}>
        <span data-testid="Tier">{displayVal}</span>
      </Space>
    );
  }

  return <span>{displayVal}</span>;
};

const EntitySummaryDetails = ({ data }: GetInfoElementsProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const displayVal = data.placeholderText || data.value;

  const { isEntityDetails, userDetails, isTier, isOwner, isTeamOwner } =
    useMemo(() => {
      const userDetails = currentUser ? getTeamsUser(data, currentUser) : {};

      return {
        isEntityCard: data?.isEntityCard,
        isEntityDetails: data?.isEntityDetails,
        userDetails,
        isTier: data.key === 'Tier',
        isOwner: data.key === 'Owner',
        isTeamOwner: isString(data.value)
          ? data.value.includes('teams/')
          : false,
      };
    }, [data]);

  const ctx: RetValContext = {
    data,
    displayVal,
    userDetails,
    isEntityDetails,
    isTeamOwner,
    isOwner,
    isTier,
    t,
  };

  return (
    <Space
      className="entity-summary-details"
      data-testid="entity-summary-details"
      direction="horizontal">
      {getRetVal(ctx)}
      {displayVal && getValueContent(ctx)}
    </Space>
  );
};

export default EntitySummaryDetails;
