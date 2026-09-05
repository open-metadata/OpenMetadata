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
import { TFunction } from 'i18next';
import { isEmpty, isString, isUndefined, lowerCase, toLower } from 'lodash';
import { ExtraInfo } from 'Models';
import { Fragment, useMemo } from 'react';
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

interface OwnerRetValProps {
  displayVal: ExtraInfo['value'];
  userDetails: Record<string, string | undefined> | undefined;
  isEntityDetails: boolean | undefined;
  isTeamOwner: boolean;
  data: ExtraInfo;
}

function OwnerRetVal({
  displayVal,
  userDetails,
  isEntityDetails,
  isTeamOwner,
  data,
}: OwnerRetValProps) {
  const { t } = useTranslation();

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
    <Fragment>
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
    </Fragment>
  );
}

function TierRetVal({ displayVal }: { displayVal: ExtraInfo['value'] }) {
  const { t } = useTranslation();

  if (!displayVal || displayVal === '--') {
    return <>{t('label.no-entity', { entity: t('label.tier') })}</>;
  }

  return <></>;
}

function UsageRetVal() {
  const { t } = useTranslation();

  return <>{`${t('label.usage')} - `}</>;
}

function DomainRetVal({ displayVal }: { displayVal: ExtraInfo['value'] }) {
  const { t } = useTranslation();

  if (isEmpty(displayVal)) {
    return (
      <span className="d-flex gap-1 items-center" data-testid="owner-link">
        {t('label.no-entity', { entity: t('label.domain-plural') })}
      </span>
    );
  }

  return (
    <DomainIcon
      className="d-flex"
      color={DE_ACTIVE_COLOR}
      height={16}
      name="folder"
      width={16}
    />
  );
}

function DefaultRetVal({
  data,
  displayVal,
}: {
  data: ExtraInfo;
  displayVal: ExtraInfo['value'];
}) {
  const { t } = useTranslation();

  if (!data.key) {
    return <>{null}</>;
  }

  if (!displayVal) {
    return (
      <>
        {`${t('label.no-entity', {
          entity: t(
            `label.${toLower(
              data.localizationKey ? data.localizationKey : data.key
            )}`
          ),
        })}`}
      </>
    );
  }

  if (!data.showLabel) {
    return <>{null}</>;
  }

  return <>{`${t(`label.${toLower(data.key)}`)} - `}</>;
}

function getOwnerTooltipContent(
  displayVal: ExtraInfo['value'],
  userDetails: Record<string, string | undefined> | undefined,
  t: TFunction
) {
  if (!displayVal) {
    return '';
  }

  return `${t('message.entity-owned-by-name', {
    entityOwner: displayVal ?? '',
  })}

                        ${t('message.and-followed-owned-by-name', {
                          userName: !isUndefined(userDetails)
                            ? userDetails.ownerName
                            : '',
                        })}`;
}

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

  function computeRetVal() {
    switch (data.key) {
      case 'Owner':
        return (
          <OwnerRetVal
            data={data}
            displayVal={displayVal}
            isEntityDetails={isEntityDetails}
            isTeamOwner={isTeamOwner}
            userDetails={userDetails}
          />
        );
      case 'Tier':
        return <TierRetVal displayVal={displayVal} />;
      case 'Usage':
        return <UsageRetVal />;
      case 'Domain':
        return <DomainRetVal displayVal={displayVal} />;
      default:
        return <DefaultRetVal data={data} displayVal={displayVal} />;
    }
  }

  const retVal = computeRetVal();

  function renderLinkContent() {
    return (
      <Fragment>
        <a
          className={classNames(
            'd-inline-block truncate link-text align-middle',
            {
              'w-52': (displayVal as string).length > 32,
            }
          )}
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
            content={getOwnerTooltipContent(displayVal, userDetails, t)}
          />
        ) : null}
      </Fragment>
    );
  }

  function renderDisplayValue() {
    return (
      <Fragment>
        {data.isLink ? (
          renderLinkContent()
        ) : isOwner ? (
          <div className="d-flex" data-testid="owner-link">
            {displayVal}
          </div>
        ) : isTier ? (
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
        ) : (
          <span>{displayVal}</span>
        )}
      </Fragment>
    );
  }

  return (
    <Space
      className="entity-summary-details"
      data-testid="entity-summary-details"
      direction="horizontal">
      {retVal}
      {displayVal && renderDisplayValue()}
    </Space>
  );
};

export default EntitySummaryDetails;
