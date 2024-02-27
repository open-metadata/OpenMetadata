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
import { Button, Space } from 'antd';
import Tooltip, { RenderFunction } from 'antd/lib/tooltip';
import classNames from 'classnames';
import { isEmpty, isString, isUndefined, lowerCase, toLower } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconExternalLink } from '../../../assets/svg/external-links.svg';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { ReactComponent as IconInfoSecondary } from '../../../assets/svg/icon-info.svg';
import { ReactComponent as IconTeamsGrey } from '../../../assets/svg/teams-grey.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getTeamsUser } from '../../../utils/CommonUtils';
import { useAuthContext } from '../../Auth/AuthProviders/AuthProvider';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import './entity-summary-details.style.less';

export interface GetInfoElementsProps {
  data: ExtraInfo;
  tier?: TagLabel;
  currentTier?: string;
  currentOwner?: Dashboard['owner'];
  deleted?: boolean;
  allowTeamOwner?: boolean;
}

const InfoIcon = ({
  content,
}: {
  content: React.ReactNode | RenderFunction;
}): JSX.Element => (
  <Tooltip title={content}>
    <Icon
      alt="info-secondary"
      component={IconInfoSecondary}
      style={{ fontSize: '12px' }}
    />
  </Tooltip>
);

const EntitySummaryDetails = ({ data }: GetInfoElementsProps) => {
  let retVal = <></>;
  const { t } = useTranslation();
  const { currentUser } = useAuthContext();
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

  switch (data.key) {
    case 'Owner':
      {
        retVal =
          displayVal && displayVal !== '--' ? (
            isString(displayVal) ? (
              <>
                {!isUndefined(userDetails) && isEntityDetails && (
                  <>
                    <ProfilePicture
                      displayName={userDetails.ownerName}
                      name={userDetails.ownerName ?? ''}
                      width="24"
                    />
                    <span data-testid="owner-link">
                      {userDetails.ownerName}
                    </span>
                    <span className="m-r-xss d-inline-block text-grey-muted">
                      {t('label.pipe-symbol')}
                    </span>
                  </>
                )}
                {isTeamOwner ? (
                  <IconTeamsGrey
                    className="align-middle"
                    height={18}
                    width={18}
                  />
                ) : (
                  <ProfilePicture
                    displayName={displayVal}
                    name={data.profileName ?? ''}
                    width={data.avatarWidth ?? '24'}
                  />
                )}
              </>
            ) : (
              <></>
            )
          ) : (
            <span
              className="d-flex gap-1 items-center"
              data-testid="owner-link">
              {t('label.no-entity', { entity: t('label.owner') })}
            </span>
          );
      }

      break;

    case 'Tier':
      {
        retVal =
          !displayVal || displayVal === '--' ? (
            <>{t('label.no-entity', { entity: t('label.tier') })}</>
          ) : (
            <></>
          );
      }

      break;

    case 'Usage':
      {
        retVal = <>{`${t('label.usage')} - `}</>;
      }

      break;

    case 'Domain':
      {
        retVal = !isEmpty(displayVal) ? (
          <DomainIcon
            className="d-flex"
            color={DE_ACTIVE_COLOR}
            height={16}
            name="folder"
            width={16}
          />
        ) : (
          <span className="d-flex gap-1 items-center" data-testid="owner-link">
            {t('label.no-entity', { entity: t('label.domain') })}
          </span>
        );
      }

      break;
    default:
      {
        retVal = (
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
      }

      break;
  }

  return (
    <Space
      className="entity-summary-details"
      data-testid="entity-summary-details"
      direction="horizontal">
      {retVal}
      {displayVal && (
        <>
          {data.isLink ? (
            <>
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
                    <IconExternalLink width={12} />
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
          ) : isOwner ? (
            <>
              <span
                className={classNames(
                  'd-inline-block truncate link-text align-middle',
                  {
                    'w-52': (displayVal as string).length > 32,
                  }
                )}
                data-testid="owner-link"
                title={displayVal as string}>
                <Button data-testid="owner-dropdown" type="link">
                  {displayVal}
                </Button>
              </span>
            </>
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
        </>
      )}
    </Space>
  );
};

export default EntitySummaryDetails;
