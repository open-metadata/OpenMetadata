import { Dropdown } from 'antd';
import classNames from 'classnames';
import { debounce, isEqual, isString } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { useCallback, useEffect, useState } from 'react';
import appState from '../../../AppState';
import { useAuthContext } from '../../../authentication/auth-provider/AuthProvider';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { Table } from '../../../generated/entity/data/table';
import { Operation } from '../../../generated/entity/policies/accessControl/rule';
import { EntityReference } from '../../../generated/type/entityReference';
import { TagLabel } from '../../../generated/type/tagLabel';
import { useAuth } from '../../../hooks/authHooks';
import { getOwnerList } from '../../../utils/ManageUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import {
  searchFormattedUsersAndTeams,
  suggestFormattedUsersAndTeams,
} from '../../../utils/UserDataUtils';
import { Button } from '../../buttons/Button/Button';
import { Status } from '../../ManageTab/ManageTab.interface';
import OwnerWidgetWrapper from '../OwnerWidget/OwnerWidgetWrapper.component';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import TierCard from '../TierCard/TierCard';

export interface GetInfoElementsProps {
  data: ExtraInfo;
  tier?: TagLabel;
  currentTier?: string;
  currentUser?: EntityReference;
  currentOwner?: Table['owner'];
  isJoinable?: boolean;
  hasEditAccess: boolean;
  updateTier?: (value: string) => void;
  updateUser?: (value: Table['owner']) => void;
  updateOwner?: (value: Table['owner']) => void;
}

const EntitySummaryDetails = ({
  data,
  tier,
  updateOwner,
  updateTier,
  currentUser,
  currentOwner,
  isJoinable,
  hasEditAccess,
}: GetInfoElementsProps) => {
  let retVal = <></>;
  const displayVal = data.placeholderText || data.value;
  const [show, setshow] = useState(false);
  const [searchText, setSearchText] = useState<string>('');
  const [isUserLoading, setIsUserLoading] = useState<boolean>(false);
  const [listOwners, setListOwners] = useState(getOwnerList());
  const [listVisible, setListVisible] = useState(false);
  const [statusOwner, setStatusOwner] = useState<Status>('initial');
  const [owner, setOwner] = useState(currentUser);
  const [teamJoinable, setTeamJoinable] = useState(isJoinable);

  const { userPermissions, isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();

  useEffect(() => {
    setTeamJoinable(isJoinable);
  }, [isJoinable]);

  const isJoinableActionAllowed = () => {
    return (
      isAdminUser ||
      isAuthDisabled ||
      userPermissions[Operation.TeamEditUsers] ||
      !hasEditAccess
    );
  };

  const setInitialOwnerLoadingState = () => {
    setStatusOwner('initial');
  };

  const getOwnerSuggestion = useCallback(
    (qSearchText = '') => {
      setIsUserLoading(true);
      suggestFormattedUsersAndTeams(qSearchText)
        .then((res) => {
          const { users, teams } = res;
          setListOwners(getOwnerList(users, teams));
        })
        .catch(() => {
          setListOwners([]);
        })
        .finally(() => {
          setIsUserLoading(false);
        });
    },
    [setListOwners, setIsUserLoading]
  );

  const prepareOwner = (updatedOwner?: EntityReference) => {
    return !isEqual(updatedOwner, currentUser) ? updatedOwner : undefined;
  };

  const handleOwnerSelection = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value = ''
  ) => {
    const owner = listOwners.find((item) => item.value === value);

    if (owner) {
      const newOwner = prepareOwner({
        type: owner.type,
        id: owner.value as string,
      });
      if (newOwner) {
        const updatedData = {
          ...currentOwner,
          ...newOwner,
        };
        updateOwner && updateOwner(updatedData);
      }
    }
    setshow(false);
  };

  const getOwnerSearch = useCallback(
    (searchQuery = WILD_CARD_CHAR, from = 1) => {
      setIsUserLoading(true);
      searchFormattedUsersAndTeams(searchQuery, from)
        .then((res) => {
          const { users, teams } = res;
          setListOwners(getOwnerList(users, teams));
        })
        .catch(() => {
          setListOwners([]);
        })
        .finally(() => {
          setIsUserLoading(false);
        });
    },
    [setListOwners, setIsUserLoading]
  );

  const debouncedOnChange = useCallback(
    (text: string): void => {
      if (text) {
        getOwnerSuggestion(text);
      } else {
        getOwnerSearch();
      }
    },
    [getOwnerSuggestion, getOwnerSearch]
  );

  const debounceOnSearch = useCallback(debounce(debouncedOnChange, 400), [
    debouncedOnChange,
  ]);

  useEffect(() => {
    debounceOnSearch(searchText);
  }, [appState.users, appState.userDetails, appState.userTeams]);

  const handleOwnerSearch = (text: string) => {
    setSearchText(text);
    debounceOnSearch(text);
  };

  useEffect(() => {
    if (listVisible) {
      handleOwnerSearch('');
    }
  }, [listVisible]);

  useEffect(() => {
    if (statusOwner === 'waiting') {
      setStatusOwner('success');
      setTimeout(() => {
        setInitialOwnerLoadingState();
      }, 300);
    }
  }, [currentUser]);

  useEffect(() => {
    setOwner(currentUser);
  }, [currentUser]);

  switch (data.key) {
    case 'Owner':
      {
        retVal =
          displayVal && displayVal !== '--' ? (
            isString(displayVal) ? (
              <div className="tw-inline-block tw-mr-2">
                <ProfilePicture
                  displayName={displayVal}
                  id=""
                  name={data.profileName || ''}
                  width={data.avatarWidth || '20'}
                />
              </div>
            ) : (
              <></>
            )
          ) : (
            <>
              No Owner
              <span onClick={() => setshow(!show)}>
                {updateOwner ? (
                  <SVGIcons
                    alt="edit"
                    icon={Icons.EDIT}
                    title="Edit"
                    width="15px"
                  />
                ) : null}
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
                <span style={{ marginLeft: '5px' }}>
                  {updateTier ? (
                    <SVGIcons
                      alt="edit"
                      icon={Icons.EDIT}
                      title="Edit"
                      width="15px"
                    />
                  ) : null}
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
    <span>
      <span className="tw-text-grey-muted">{retVal}</span>
      {displayVal ? (
        <span>
          {data.isLink ? (
            <>
              <a
                data-testid="owner-link"
                href={data.value as string}
                rel="noopener noreferrer"
                target={data.openInNewTab ? '_blank' : '_self'}>
                <>
                  <span
                    className={classNames(
                      'tw-mr-1 tw-inline-block tw-truncate link-text tw-align-middle',
                      {
                        'tw-w-52': (displayVal as string).length > 32,
                      }
                    )}>
                    {displayVal}
                  </span>

                  {data.openInNewTab && (
                    <SVGIcons
                      alt="external-link"
                      className="tw-align-middle"
                      icon="external-link"
                      width="16px"
                    />
                  )}
                </>
              </a>
              <span style={{ marginLeft: '5px' }} onClick={() => setshow(true)}>
                <SVGIcons
                  alt="edit"
                  icon={Icons.EDIT}
                  title="Edit"
                  width="15px"
                />
              </span>
            </>
          ) : (
            <>
              {data.key === 'Owner' ? (
                <>
                  <span
                    className={classNames(
                      'tw-mr-1 tw-inline-block tw-truncate tw-align-middle',
                      { 'tw-w-52': (displayVal as string).length > 32 }
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
                      style={{ marginLeft: '5px' }}
                      onClick={() => setshow(true)}>
                      {updateOwner ? (
                        <SVGIcons
                          alt="edit"
                          icon={Icons.EDIT}
                          title="Edit"
                          width="15px"
                        />
                      ) : null}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  {data.key === 'Tier' ? (
                    <>
                      <span
                        className={classNames(
                          'tw-mr-1 tw-inline-block tw-truncate tw-align-middle',
                          { 'tw-w-52': (displayVal as string).length > 32 }
                        )}
                        data-testid="tier-name"
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
                            trigger={['click']}>
                            <span style={{ marginLeft: '5px' }}>
                              {updateTier ? (
                                <SVGIcons
                                  alt="edit"
                                  icon={Icons.EDIT}
                                  title="Edit"
                                  width="15px"
                                />
                              ) : null}
                            </span>
                          </Dropdown>
                        </span>
                      </span>
                    </>
                  ) : (
                    <span>{displayVal}</span>
                  )}
                </>
              )}
            </>
          )}
        </span>
      ) : null}
      <OwnerWidgetWrapper
        handleOwnerSelection={handleOwnerSelection}
        handleSearchOwnerDropdown={handleOwnerSearch}
        handleSelectOwnerDropdown={() => setListVisible((visible) => !visible)}
        hideWidget={() => setshow(true)}
        isJoinableActionAllowed={isJoinableActionAllowed()}
        isListLoading={isUserLoading}
        listOwners={listOwners}
        owner={owner || ({} as EntityReference)}
        ownerName={currentUser?.displayName || currentUser?.name || ''}
        ownerSearchText={searchText}
        statusOwner={statusOwner}
        teamJoinable={teamJoinable}
        updateUser={updateOwner}
        visible={show}
      />
    </span>
  );
};

export default EntitySummaryDetails;
