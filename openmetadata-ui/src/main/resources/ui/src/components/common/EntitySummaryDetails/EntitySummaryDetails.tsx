import { Dropdown, Space } from 'antd';
import Tooltip, { RenderFunction } from 'antd/lib/tooltip';
import classNames from 'classnames';
import { isString, isUndefined } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { useMemo, useState } from 'react';
import { Table } from '../../../generated/entity/data/table';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getTeamsUser } from '../../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';
import OwnerWidgetWrapper from '../OwnerWidget/OwnerWidgetWrapper.component';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import TierCard from '../TierCard/TierCard';
import './EntitySummaryDetails.style.less';

export interface GetInfoElementsProps {
  data: ExtraInfo;
  updateOwner?: (value: Table['owner']) => void;
  tier?: TagLabel;
  currentTier?: string;
  updateTier?: (value: string) => void;
}

const EditIcon = (): JSX.Element => (
  <SVGIcons
    alt="edit"
    className="tw-cursor-pointer tw-align-text-top"
    icon={Icons.EDIT}
    title="Edit"
    width="15px"
  />
);

const InfoIcon = ({
  content,
}: {
  content: React.ReactNode | RenderFunction;
}): JSX.Element => (
  <Tooltip className="tw-ml-2" title={content}>
    <SVGIcons alt="info-secondary" icon="info-secondary" width="12px" />
  </Tooltip>
);

const EntitySummaryDetails = ({
  data,
  tier,
  updateOwner,
  updateTier,
}: GetInfoElementsProps) => {
  let retVal = <></>;
  const displayVal = data.placeholderText || data.value;
  const [show, setShow] = useState(false);

  const { isEntityDetails, userDetails, isTier, isOwner } = useMemo(() => {
    const userDetails = getTeamsUser(data);

    return {
      isEntityCard: data?.isEntityCard,
      isEntityDetails: data?.isEntityDetails,
      userDetails,
      isTier: data.key === 'Tier',
      isOwner: data.key === 'Owner',
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
                      |
                    </span>
                  </>
                )}
                <ProfilePicture
                  displayName={displayVal}
                  id=""
                  name={data.profileName || ''}
                  width={data.avatarWidth || '20'}
                />
              </>
            ) : (
              <></>
            )
          ) : (
            <>
              No Owner
              <span
                data-testid={`edit-${data.key}-icon`}
                onClick={() => setShow(!show)}>
                {updateOwner ? <EditIcon /> : null}
              </span>
            </>
          );
      }

      break;
    case 'Tier':
      {
        retVal =
          !displayVal || displayVal === '--' ? (
            <>
              No Tier
              <Dropdown
                overlay={
                  <TierCard
                    currentTier={tier?.tagFQN}
                    updateTier={updateTier}
                  />
                }
                trigger={['click']}>
                <span data-testid={`edit-${data.key}-icon`}>
                  {updateTier ? <EditIcon /> : null}
                </span>
              </Dropdown>
            </>
          ) : (
            <></>
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
                  ? `${data.key}: `
                  : null
                : `No ${data.key}`
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
                data-testid="owner-link"
                href={data.value as string}
                rel="noopener noreferrer"
                target={data.openInNewTab ? '_blank' : '_self'}>
                {displayVal}
                {isEntityDetails && (
                  <InfoIcon
                    content={
                      displayVal
                        ? `This Entity is Owned by ${displayVal} ${
                            !isUndefined(userDetails)
                              ? `and followed team owned by ${userDetails.ownerName}`
                              : ''
                          }`
                        : ''
                    }
                  />
                )}
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
              {(isOwner || isTier) && (
                <span
                  data-testid={`edit-${data.key}-icon`}
                  onClick={() => setShow(true)}>
                  {updateOwner ? <EditIcon /> : null}
                </span>
              )}
            </>
          ) : (
            <>
              {isOwner ? (
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

                    <span
                      className="tw-ml-2"
                      data-testid={`edit-${data.key}-icon`}
                      onClick={() => setShow(true)}>
                      {updateOwner ? <EditIcon /> : null}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  {isTier ? (
                    <>
                      <Space
                        className={classNames(
                          'tw-mr-1  tw-truncate tw-align-middle',
                          { 'tw-w-52': (displayVal as string).length > 32 }
                        )}
                        data-testid="tier-name"
                        direction="horizontal"
                        size={0.1}
                        title={displayVal as string}>
                        <Button
                          data-testid="tier-dropdown"
                          size="custom"
                          theme="primary"
                          variant="text">
                          {displayVal}
                        </Button>
                        <span>
                          <Dropdown
                            overlay={
                              <TierCard
                                currentTier={tier?.tagFQN}
                                updateTier={updateTier}
                              />
                            }
                            placement="bottomRight"
                            trigger={['click']}>
                            <span
                              className="tw-flex"
                              data-testid={`edit-${data.key}-icon`}>
                              {updateTier ? <EditIcon /> : null}
                            </span>
                          </Dropdown>
                        </span>
                      </Space>
                    </>
                  ) : (
                    <span>{displayVal}</span>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
      <OwnerWidgetWrapper
        hideWidget={() => setShow(false)}
        updateUser={updateOwner}
        visible={show}
      />
    </Space>
  );
};

export default EntitySummaryDetails;
