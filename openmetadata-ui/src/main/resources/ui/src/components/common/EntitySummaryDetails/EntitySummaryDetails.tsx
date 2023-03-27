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

import { Button as AntdButton, Dropdown, Space } from 'antd';
import Tooltip, { RenderFunction } from 'antd/lib/tooltip';
import { ReactComponent as IconTeamsGrey } from 'assets/svg/teams-grey.svg';
import classNames from 'classnames';
import { isString, isUndefined, lowerCase, noop, toLower } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { Table } from '../../../generated/entity/data/table';
import { TeamType } from '../../../generated/entity/teams/team';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getTeamsUser } from '../../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import TeamTypeSelect from '../TeamTypeSelect/TeamTypeSelect.component';
import TierCard from '../TierCard/TierCard';
import { UserSelectableList } from '../UserSelectableList/UserSelectableList.component';
import { UserTeamSelectableList } from '../UserTeamSelectableList/UserTeamSelectableList.component';
import './EntitySummaryDetails.style.less';

export interface GetInfoElementsProps {
  data: ExtraInfo;
  updateOwner?: (value: Table['owner']) => void;
  tier?: TagLabel;
  currentTier?: string;
  teamType?: TeamType;
  showGroupOption?: boolean;
  isGroupType?: boolean;
  updateTier?: (value: string) => void;
  updateTeamType?: (type: TeamType) => void;
  currentOwner?: Dashboard['owner'];
  removeTier?: () => void;
  deleted?: boolean;
  allowTeamOwner?: boolean;
}

const EditIcon = ({ iconClasses }: { iconClasses?: string }): JSX.Element => (
  <SVGIcons
    alt="edit"
    className={classNames('tw-cursor-pointer tw-align-text-top', iconClasses)}
    icon={Icons.EDIT}
    title="Edit"
    width="16px"
  />
);

const InfoIcon = ({
  content,
}: {
  content: React.ReactNode | RenderFunction;
}): JSX.Element => (
  <Tooltip title={content}>
    <SVGIcons alt="info-secondary" icon="info-secondary" width="12px" />
  </Tooltip>
);

const EntitySummaryDetails = ({
  data,
  isGroupType,
  tier,
  teamType,
  showGroupOption,
  updateOwner,
  updateTier,
  updateTeamType,
  removeTier,
  currentOwner,
  deleted = false,
  allowTeamOwner = true,
}: GetInfoElementsProps) => {
  let retVal = <></>;
  const { t } = useTranslation();
  const displayVal = data.placeholderText || data.value;

  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const handleShowTypeSelector = useCallback((value: boolean) => {
    setShowTypeSelector(value);
  }, []);

  const ownerDropdown = allowTeamOwner ? (
    <UserTeamSelectableList
      hasPermission={Boolean(updateOwner)}
      owner={currentOwner}
      onUpdate={updateOwner ?? noop}
    />
  ) : (
    <UserSelectableList
      hasPermission={Boolean(updateOwner)}
      multiSelect={false}
      selectedUsers={currentOwner ? [currentOwner] : []}
      onUpdate={updateOwner ?? noop}
    />
  );

  const {
    isEntityDetails,
    userDetails,
    isTier,
    isOwner,
    isTeamType,
    isTeamOwner,
  } = useMemo(() => {
    const userDetails = getTeamsUser(data);

    return {
      isEntityCard: data?.isEntityCard,
      isEntityDetails: data?.isEntityDetails,
      userDetails,
      isTier: data.key === 'Tier',
      isOwner: data.key === 'Owner',
      isTeamType: data.key === 'TeamType',
      isTeamOwner: isString(data.value) ? data.value.includes('teams/') : false,
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
                      id={userDetails.id as string}
                      name={userDetails.ownerName || ''}
                      width="20"
                    />
                    <span>{userDetails.ownerName}</span>
                    <span className="tw-mr-1 tw-inline-block tw-text-gray-400">
                      {t('label.pipe-symbol')}
                    </span>
                  </>
                )}
                {isTeamOwner ? (
                  <IconTeamsGrey height={18} width={18} />
                ) : (
                  <ProfilePicture
                    displayName={displayVal}
                    id=""
                    name={data.profileName || ''}
                    width={data.avatarWidth || '20'}
                  />
                )}
              </>
            ) : (
              <></>
            )
          ) : (
            <>
              {t('label.no-entity', { entity: t('label.owner') })}
              {updateOwner && !deleted ? ownerDropdown : null}
            </>
          );
      }

      break;

    case 'Tier':
      {
        retVal =
          !displayVal || displayVal === '--' ? (
            <>
              {t('label.no-entity', { entity: t('label.tier') })}
              <Dropdown
                dropdownRender={() => (
                  <TierCard
                    currentTier={tier?.tagFQN}
                    removeTier={removeTier}
                    updateTier={updateTier}
                  />
                )}
                trigger={['click']}>
                <span data-testid={`edit-${data.key}-icon`}>
                  {updateTier && !deleted ? <EditIcon /> : null}
                </span>
              </Dropdown>
            </>
          ) : (
            <></>
          );
      }

      break;

    case 'TeamType':
      {
        retVal = displayVal ? <>{`${t('label.type')} - `}</> : <></>;
      }

      break;

    case 'Usage':
      {
        retVal = <>{`${t('label.usage')} - `}</>;
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
                  'tw-inline-block tw-truncate link-text tw-align-middle',
                  {
                    'tw-w-52': (displayVal as string).length > 32,
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
                    <SVGIcons
                      alt="external-link"
                      className="tw-align-middle"
                      icon="external-link"
                      width="16px"
                    />
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
              {/* Edit icon with dropdown */}
              {(isOwner || isTier) && (updateOwner ? ownerDropdown : null)}
            </>
          ) : isOwner ? (
            <>
              <span
                className={classNames(
                  'tw-inline-block tw-truncate tw-align-middle',
                  {
                    'tw-w-52': (displayVal as string).length > 32,
                  }
                )}
                data-testid="owner-name"
                title={displayVal as string}>
                <Button
                  data-testid="owner-dropdown"
                  size="custom"
                  theme="primary"
                  variant="text">
                  {displayVal}
                </Button>
              </span>
              {/* Edit icon with dropdown */}
              {updateOwner ? ownerDropdown : null}
            </>
          ) : isTier ? (
            <Space
              className={classNames('tw-mr-1  tw-truncate tw-align-middle', {
                'tw-w-52': (displayVal as string).length > 32,
              })}
              data-testid="tier-name"
              direction="horizontal"
              title={displayVal as string}>
              <span data-testid="tier-dropdown">{displayVal}</span>
              <Dropdown
                overlay={
                  <TierCard
                    currentTier={tier?.tagFQN}
                    removeTier={removeTier}
                    updateTier={updateTier}
                  />
                }
                placement="bottomRight"
                trigger={['click']}>
                <span
                  className="tw-flex tw--mt-0.5"
                  data-testid={`edit-${data.key}-icon`}>
                  {updateTier ? <EditIcon /> : null}
                </span>
              </Dropdown>
            </Space>
          ) : isTeamType ? (
            showTypeSelector ? (
              <TeamTypeSelect
                handleShowTypeSelector={handleShowTypeSelector}
                showGroupOption={showGroupOption ?? false}
                teamType={teamType ?? TeamType.Department}
                updateTeamType={updateTeamType}
              />
            ) : (
              <>
                {displayVal}
                <Tooltip
                  placement="bottom"
                  title={
                    isGroupType
                      ? t('message.group-team-type-change-message')
                      : t('label.edit-entity', {
                          entity: t('label.team-type'),
                        })
                  }>
                  <AntdButton
                    className={isGroupType ? 'tw-opacity-50' : ''}
                    data-testid={`edit-${data.key}-icon`}
                    disabled={isGroupType}
                    onClick={() => setShowTypeSelector(true)}>
                    {updateTeamType ? <EditIcon /> : null}
                  </AntdButton>
                </Tooltip>
              </>
            )
          ) : (
            <span>{displayVal}</span>
          )}
        </>
      )}
    </Space>
  );
};

export default EntitySummaryDetails;
