/*
 *  Copyright 2021 Collate
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

import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { observer } from 'mobx-react';
import { TableDetail } from 'Models';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import appState from '../../AppState';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { getCategory } from '../../axiosAPIs/tagAPI';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import { getOwnerList } from '../../utils/ManageUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import CardListItem from '../cardlist/CardListItem/CardWithListItem';
import { CardWithListItems } from '../cardlist/CardListItem/CardWithListItem.interface';
import DeleteWidget from '../common/DeleteWidget/DeleteWidget';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import OwnerWidget from '../common/OwnerWidget/OwnerWidget';
import Loader from '../Loader/Loader';
import { ManageProps, Status } from './ManageTab.interface';

const ManageTab: FunctionComponent<ManageProps> = ({
  currentTier = '',
  currentUser = '',
  hideTier = false,
  hideOwner = false,
  onSave,
  hasEditAccess,
  allowTeamOwner = true,
  isJoinable,
  allowDelete,
  entityName,
  entityType,
  entityId,
  allowSoftDelete,
  isRecursiveDelete,
  deletEntityMessage,
  handleIsJoinable,
}: ManageProps) => {
  const { userPermissions, isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();

  const [statusOwner, setStatusOwner] = useState<Status>('initial');
  const [statusTier, setStatusTier] = useState<Status>('initial');
  const [activeTier, setActiveTier] = useState(currentTier);
  const [listVisible, setListVisible] = useState(false);
  const [teamJoinable, setTeamJoinable] = useState(isJoinable);

  const [tierData, setTierData] = useState<Array<CardWithListItems>>([]);
  const [listOwners, setListOwners] = useState(getOwnerList());
  const [owner, setOwner] = useState(currentUser);
  const [isLoadingTierData, setIsLoadingTierData] = useState<boolean>(false);

  const getOwnerById = (): string => {
    return listOwners.find((item) => item.value === owner)?.name || '';
  };

  const setInitialOwnerLoadingState = () => {
    setStatusOwner('initial');
  };

  const setInitialTierLoadingState = () => {
    setStatusTier('initial');
  };

  const prepareOwner = (updatedOwner: string) => {
    return updatedOwner !== currentUser
      ? {
          id: updatedOwner,
          type: listOwners.find((item) => item.value === updatedOwner)?.type as
            | 'user'
            | 'team',
        }
      : undefined;
  };

  const prepareTier = (updatedTier: string) => {
    return updatedTier !== currentTier ? updatedTier : undefined;
  };

  const handleOwnerSave = (updatedOwner: string, updatedTier: string) => {
    setStatusOwner('waiting');
    const newOwner: TableDetail['owner'] = prepareOwner(updatedOwner);
    if (hideTier) {
      if (newOwner || !isUndefined(teamJoinable)) {
        onSave?.(newOwner, '', Boolean(teamJoinable)).catch(() => {
          setInitialOwnerLoadingState();
        });
      } else {
        setInitialOwnerLoadingState();
      }
    } else {
      const newTier = prepareTier(updatedTier);
      onSave?.(newOwner, newTier, Boolean(teamJoinable)).catch(() => {
        setInitialOwnerLoadingState();
      });
    }
  };

  const handleTierSave = (updatedTier: string) => {
    setStatusTier('waiting');
    const newOwner: TableDetail['owner'] = prepareOwner(currentUser);
    if (hideTier) {
      if (newOwner || !isUndefined(teamJoinable)) {
        onSave?.(newOwner, '', Boolean(teamJoinable)).catch(() => {
          setInitialTierLoadingState();
        });
      } else {
        setInitialTierLoadingState();
      }
    } else {
      const newTier = prepareTier(updatedTier);
      onSave?.(newOwner, newTier, Boolean(teamJoinable)).catch(() => {
        setInitialTierLoadingState();
      });
    }
  };

  const handleOwnerSelection = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    if (value) {
      const newOwner = listOwners.find((item) => item.value === value);
      if (newOwner) {
        setOwner(newOwner.value);
        handleOwnerSave(newOwner.value, activeTier);
      }
    }
    setListVisible(false);
  };

  const handleCardSelection = (cardId: string) => {
    setActiveTier(cardId);
  };

  const getDeleteEntityWidget = () => {
    return allowDelete && entityId && entityName && entityType ? (
      <div className="tw-mt-1" data-testid="danger-zone">
        <DeleteWidget
          allowSoftDelete={allowSoftDelete}
          deletEntityMessage={deletEntityMessage}
          entityId={entityId}
          entityName={entityName}
          entityType={entityType}
          hasPermission={isAdminUser || isAuthDisabled}
          isAdminUser={isAdminUser}
          isRecursiveDelete={isRecursiveDelete}
        />
      </div>
    ) : null;
  };

  const getTierCards = () => {
    return (
      <div className="tw-flex tw-flex-col tw-mb-7" data-testid="cards">
        {tierData.map((card, i) => (
          <NonAdminAction
            html={
              <Fragment>
                <p>You need to be owner to perform this action</p>
                <p>Claim ownership from above </p>
              </Fragment>
            }
            isOwner={hasEditAccess || Boolean(owner && !currentUser)}
            key={i}
            permission={Operation.UpdateTags}
            position="left">
            <CardListItem
              card={card}
              className={classNames(
                'tw-mb-0 tw-shadow',
                {
                  'tw-rounded-t-md': i === 0,
                },
                {
                  'tw-rounded-b-md ': i === tierData.length - 1,
                }
              )}
              isActive={activeTier === card.id}
              isSelected={card.id === currentTier}
              tierStatus={statusTier}
              onCardSelect={handleCardSelection}
              onSave={handleTierSave}
            />
          </NonAdminAction>
        ))}
      </div>
    );
  };

  const getTierWidget = () => {
    if (hideTier) {
      return null;
    } else {
      return isLoadingTierData ? <Loader /> : getTierCards();
    }
  };

  const isJoinableActionAllowed = () => {
    return (
      isAdminUser ||
      isAuthDisabled ||
      userPermissions[Operation.UpdateTeam] ||
      !hasEditAccess
    );
  };

  const ownerName = getOwnerById();
  const getTierData = () => {
    setIsLoadingTierData(true);
    getCategory('Tier')
      .then((res: AxiosResponse) => {
        if (res.data) {
          const tierData = res.data.children.map(
            (tier: { name: string; description: string }) => ({
              id: `Tier${FQN_SEPARATOR_CHAR}${tier.name}`,
              title: tier.name,
              description: tier.description.substring(
                0,
                tier.description.indexOf('\n\n')
              ),
              data: tier.description.substring(
                tier.description.indexOf('\n\n') + 1
              ),
            })
          );

          setTierData(tierData);
        } else {
          setTierData([]);
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-tiers-error']
        );
      })
      .finally(() => {
        setIsLoadingTierData(false);
      });
  };

  useEffect(() => {
    if (!hideTier) {
      getTierData();
    }
  }, []);

  useEffect(() => {
    setActiveTier(currentTier);
  }, [currentTier]);

  useEffect(() => {
    setOwner(currentUser);
  }, [currentUser]);

  useEffect(() => {
    if (statusOwner === 'waiting') {
      setStatusOwner('success');
      setTimeout(() => {
        setInitialOwnerLoadingState();
      }, 3000);
    }
  }, [currentUser]);

  useEffect(() => {
    if (statusTier === 'waiting') {
      setStatusTier('success');
      setTimeout(() => {
        setInitialTierLoadingState();
      }, 3000);
    }
  }, [currentTier]);

  useEffect(() => {
    setListOwners(getOwnerList());
  }, [appState.users, appState.userDetails, appState.userTeams]);

  useEffect(() => {
    setTeamJoinable(isJoinable);
  }, [isJoinable]);

  return (
    <div
      className="tw-max-w-3xl tw-mx-auto"
      data-testid="manage-tab"
      id="manageTabDetails">
      <div
        className={classNames('tw-mt-2 tw-pb-4', {
          'tw-mb-3': !hideTier,
        })}>
        {!hideOwner && (
          <OwnerWidget
            allowTeamOwner={allowTeamOwner}
            handleIsJoinable={handleIsJoinable}
            handleOwnerSelection={handleOwnerSelection}
            handleSelectOwnerDropdown={() =>
              setListVisible((visible) => !visible)
            }
            hasEditAccess={hasEditAccess}
            isAuthDisabled={isAuthDisabled}
            isJoinableActionAllowed={isJoinableActionAllowed()}
            listOwners={listOwners}
            listVisible={listVisible}
            owner={owner}
            ownerName={ownerName}
            statusOwner={statusOwner}
            teamJoinable={teamJoinable}
          />
        )}
      </div>
      {getTierWidget()}
      {getDeleteEntityWidget()}
    </div>
  );
};

export default observer(ManageTab);
