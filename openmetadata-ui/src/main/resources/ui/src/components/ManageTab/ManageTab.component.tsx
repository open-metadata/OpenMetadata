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
import { debounce, isEqual, isUndefined } from 'lodash';
import { observer } from 'mobx-react';
import React, {
  Fragment,
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import appState from '../../AppState';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { getCategory } from '../../axiosAPIs/tagAPI';
import {
  FQN_SEPARATOR_CHAR,
  WILD_CARD_CHAR,
} from '../../constants/char.constants';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { EntityReference } from '../../generated/type/entityReference';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import { getOwnerList } from '../../utils/ManageUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  searchFormattedUsersAndTeams,
  suggestFormattedUsersAndTeams,
} from '../../utils/UserDataUtils';
import CardListItem from '../cardlist/CardListItem/CardWithListItem';
import { CardWithListItems } from '../cardlist/CardListItem/CardWithListItem.interface';
import DeleteWidget from '../common/DeleteWidget/DeleteWidget';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import OwnerWidget from '../common/OwnerWidget/OwnerWidget';
import Loader from '../Loader/Loader';
import { ManageProps, Status } from './ManageTab.interface';

const ManageTab: FunctionComponent<ManageProps> = ({
  currentTier = '',
  currentUser,
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
  afterDeleteAction,
}: ManageProps) => {
  const { userPermissions, isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();

  const [isUserLoading, setIsUserLoading] = useState<boolean>(false);
  const [statusOwner, setStatusOwner] = useState<Status>('initial');
  const [statusTier, setStatusTier] = useState<Status>('initial');
  const [activeTier, setActiveTier] = useState(currentTier);
  const [listVisible, setListVisible] = useState(false);
  const [teamJoinable, setTeamJoinable] = useState(isJoinable);

  const [tierData, setTierData] = useState<Array<CardWithListItems>>([]);
  const [listOwners, setListOwners] = useState(getOwnerList());
  const [owner, setOwner] = useState(currentUser);
  const [isLoadingTierData, setIsLoadingTierData] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');

  const setInitialOwnerLoadingState = () => {
    setStatusOwner('initial');
  };

  const setInitialTierLoadingState = () => {
    setStatusTier('initial');
  };

  const prepareOwner = (updatedOwner?: EntityReference) => {
    return !isEqual(updatedOwner, currentUser) ? updatedOwner : undefined;
  };

  const prepareTier = (updatedTier: string) => {
    return updatedTier !== currentTier ? updatedTier : undefined;
  };

  const handleOwnerSave = (
    updatedOwner: EntityReference,
    updatedTier: string
  ) => {
    setStatusOwner('waiting');
    const newOwner = prepareOwner(updatedOwner);
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
    const newOwner = prepareOwner(currentUser);
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
        const { value: id, type } = newOwner;
        setOwner({ id, type });
        handleOwnerSave({ id, type }, activeTier);
      }
    }
    setListVisible(false);
  };

  const handleCardSelection = (cardId: string) => {
    setActiveTier(cardId);
  };

  const getOwnerSearch = useCallback(
    (searchQuery = WILD_CARD_CHAR, from = 1) => {
      setIsUserLoading(true);
      // const promises = [
      //   getSearchedUsers(searchQuery, from),
      //   getSearchedTeams(searchQuery, from),
      // ];
      // Promise.allSettled(promises)
      //   .then(
      //     ([resUsers, resTeams]: Array<
      //       PromiseSettledResult<SearchResponse>
      //     >) => {
      //       const users =
      //         resUsers.status === 'fulfilled'
      //           ? formatUsersResponse(resUsers.value.data.hits.hits)
      //           : [];
      //       const teams =
      //         resTeams.status === 'fulfilled'
      //           ? formatTeamsResponse(resTeams.value.data.hits.hits)
      //           : [];
      //       setListOwners(getOwnerList(users, teams));
      //     }
      //   )
      //   .catch(() => {
      //     // console.log('Failed to fetch search results: ', err);
      //     setListOwners([]);
      //   })
      //   .finally(() => {
      //     setIsUserLoading(false);
      //   });

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

  const getOwnerSuggestion = useCallback(
    (searchText = '') => {
      setIsUserLoading(true);
      // getUserSuggestions(searchText)
      //   .then((res: AxiosResponse) => {
      //     const { users, teams } = formatTeamsAndUsersResponse(
      //       res.data.suggest['table-suggest'][0].options
      //     );
      //     setListOwners(getOwnerList(users, teams));
      //   })
      //   .catch(() => {
      //     setListOwners(getOwnerList());
      //   })
      //   .finally(() => setIsUserLoading(false));

      suggestFormattedUsersAndTeams(searchText)
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

  const handleOwnerSearch = (text: string) => {
    setSearchText(text);
    debounceOnSearch(text);
  };

  const getDeleteEntityWidget = () => {
    return allowDelete && entityId && entityName && entityType ? (
      <div className="tw-mt-1" data-testid="danger-zone">
        <DeleteWidget
          afterDeleteAction={afterDeleteAction}
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
    if (!hideOwner) {
      getOwnerSearch();
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
      }, 300);
    }
  }, [currentUser]);

  useEffect(() => {
    if (statusTier === 'waiting') {
      setStatusTier('success');
      setTimeout(() => {
        setInitialTierLoadingState();
      }, 300);
    }
  }, [currentTier]);

  useEffect(() => {
    // setListOwners(getOwnerList());
    debounceOnSearch(searchText);
  }, [appState.users, appState.userDetails, appState.userTeams]);

  useEffect(() => {
    setTeamJoinable(isJoinable);
  }, [isJoinable]);

  useEffect(() => {
    if (!listVisible) {
      // setSearchText('');
      // setListOwners(getOwnerList());
      handleOwnerSearch('');
    }
  }, [listVisible]);

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
            entityType={entityType}
            handleIsJoinable={handleIsJoinable}
            handleOwnerSelection={handleOwnerSelection}
            handleSearchOwnerDropdown={handleOwnerSearch}
            handleSelectOwnerDropdown={() =>
              setListVisible((visible) => !visible)
            }
            hasEditAccess={hasEditAccess}
            isAuthDisabled={isAuthDisabled}
            isJoinableActionAllowed={isJoinableActionAllowed()}
            isListLoading={isUserLoading}
            listOwners={listOwners}
            listVisible={listVisible}
            owner={owner || ({} as EntityReference)}
            ownerName={currentUser?.displayName || currentUser?.name || ''}
            ownerSearchText={searchText}
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
