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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { observer } from 'mobx-react';
import { TableDetail } from 'Models';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import appState from '../../AppState';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { deleteEntity } from '../../axiosAPIs/miscAPI';
import { getCategory } from '../../axiosAPIs/tagAPI';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { ENTITY_DELETE_STATE } from '../../constants/entity.constants';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import { getOwnerList } from '../../utils/ManageUtils';
import SVGIcons from '../../utils/SvgUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { Button } from '../buttons/Button/Button';
import CardListItem from '../card-list/CardListItem/CardWithListItems';
import { CardWithListItems } from '../card-list/CardListItem/CardWithListItems.interface';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import DropDownList from '../dropdown/DropDownList';
import Loader from '../Loader/Loader';
import EntityDeleteModal from '../Modals/EntityDeleteModal/EntityDeleteModal';
import { ManageProps } from './ManageTab.interface';

const ManageTab: FunctionComponent<ManageProps> = ({
  currentTier = '',
  currentUser = '',
  hideTier = false,
  onSave,
  hasEditAccess,
  allowTeamOwner = true,
  isJoinable,
  allowDelete,
  entityName,
  entityType,
  entityId,
}: ManageProps) => {
  const history = useHistory();
  const { userPermissions, isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();

  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<'initial' | 'waiting' | 'success'>(
    'initial'
  );
  const [activeTier, setActiveTier] = useState(currentTier);
  const [listVisible, setListVisible] = useState(false);
  const [teamJoinable, setTeamJoinable] = useState(isJoinable);

  const [tierData, setTierData] = useState<Array<CardWithListItems>>([]);
  const [listOwners, setListOwners] = useState(getOwnerList());
  const [owner, setOwner] = useState(currentUser);
  const [isLoadingTierData, setIsLoadingTierData] = useState<boolean>(false);
  const [entityDeleteState, setEntityDeleteState] =
    useState<typeof ENTITY_DELETE_STATE>(ENTITY_DELETE_STATE);

  const getOwnerById = (): string => {
    return listOwners.find((item) => item.value === owner)?.name || '';
  };

  const getOwnerGroup = () => {
    return allowTeamOwner ? ['Teams', 'Users'] : ['Users'];
  };

  const handleOwnerSelection = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    if (value) {
      const newOwner = listOwners.find((item) => item.value === value);
      if (newOwner) {
        setOwner(newOwner.value);
      }
    }
    setListVisible(false);
  };

  const handleCardSelection = (cardId: string) => {
    setActiveTier(cardId);
  };

  const setInitialLoadingState = () => {
    setStatus('initial');
    setLoading(false);
  };

  const handleSave = () => {
    setLoading(true);
    setStatus('waiting');
    // Save API call goes here...
    const newOwner: TableDetail['owner'] =
      owner !== currentUser
        ? {
            id: owner,
            type: listOwners.find((item) => item.value === owner)?.type as
              | 'user'
              | 'team',
          }
        : undefined;
    if (hideTier) {
      if (newOwner || !isUndefined(teamJoinable)) {
        onSave(newOwner, '', Boolean(teamJoinable)).catch(() => {
          setInitialLoadingState();
        });
      } else {
        setInitialLoadingState();
      }
    } else {
      const newTier = activeTier !== currentTier ? activeTier : undefined;
      onSave(newOwner, newTier, Boolean(teamJoinable)).catch(() => {
        setInitialLoadingState();
      });
    }
  };

  const handleCancel = () => {
    setActiveTier(currentTier);
    setOwner(currentUser);
  };

  const handleOnEntityDelete = () => {
    setEntityDeleteState((prev) => ({ ...prev, state: true }));
  };

  const handleOnEntityDeleteCancel = () => {
    setEntityDeleteState(ENTITY_DELETE_STATE);
  };

  const handleOnEntityDeleteConfirm = () => {
    setEntityDeleteState((prev) => ({ ...prev, loading: 'waiting' }));
    deleteEntity(`${entityType}s`, entityId)
      .then((res: AxiosResponse) => {
        if (res.status === 200) {
          setTimeout(() => {
            handleOnEntityDeleteCancel();
            showSuccessToast(
              jsonData['api-success-messages']['delete-entity-success']
            );
            setTimeout(() => {
              history.push('/');
            }, 500);
          }, 1000);
        } else {
          showErrorToast(
            jsonData['api-error-messages']['unexpected-server-response']
          );
        }
      })
      .catch((error: AxiosError) => {
        showErrorToast(
          error,
          jsonData['api-error-messages']['delete-entity-error']
        );
      })
      .finally(() => {
        handleOnEntityDeleteCancel();
      });
  };

  const getDeleteModal = () => {
    if (allowDelete && entityDeleteState.state) {
      return (
        <EntityDeleteModal
          entityName={entityName as string}
          entityType={entityType as string}
          loadingState={entityDeleteState.loading}
          onCancel={handleOnEntityDeleteCancel}
          onConfirm={handleOnEntityDeleteConfirm}
        />
      );
    } else {
      return null;
    }
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
          setIsLoadingTierData(false);
        } else {
          setTierData([]);
          setIsLoadingTierData(false);
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-tiers-error']
        );
      });
  };

  const ownerName = getOwnerById();

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
    setTimeout(() => {
      setLoading(false);
    }, 1000);
    if (status === 'waiting') {
      setStatus('success');
      setTimeout(() => {
        setStatus('initial');
      }, 3000);
    }
  }, [currentTier, currentUser]);

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
      <div className="tw-mt-2 tw-mb-4 tw-pb-4 tw-border-b tw-border-separator ">
        <div>
          <span className="tw-mr-2">Owner:</span>
          <span className="tw-relative">
            <NonAdminAction
              html={
                <Fragment>
                  <p>You do not have permissions to update the owner.</p>
                </Fragment>
              }
              isOwner={hasEditAccess}
              permission={Operation.UpdateOwner}
              position="left">
              <Button
                className={classNames('tw-underline', {
                  'tw-opacity-40':
                    !userPermissions[Operation.UpdateOwner] &&
                    !isAuthDisabled &&
                    !hasEditAccess,
                })}
                data-testid="owner-dropdown"
                disabled={
                  !userPermissions[Operation.UpdateOwner] &&
                  !isAuthDisabled &&
                  !hasEditAccess
                }
                size="custom"
                theme="primary"
                variant="link"
                onClick={() => setListVisible((visible) => !visible)}>
                {ownerName ? (
                  <span
                    className={classNames('tw-truncate', {
                      'tw-w-52': ownerName.length > 32,
                    })}
                    title={ownerName}>
                    {ownerName}
                  </span>
                ) : (
                  'Select Owner'
                )}
                <SVGIcons
                  alt="edit"
                  className="tw-ml-1"
                  icon="icon-edit"
                  title="Edit"
                  width="12px"
                />
              </Button>
            </NonAdminAction>
            {listVisible && (
              <DropDownList
                showSearchBar
                dropDownList={listOwners}
                groupType="tab"
                listGroups={getOwnerGroup()}
                value={owner}
                onSelect={handleOwnerSelection}
              />
            )}
          </span>
        </div>
        {!isUndefined(isJoinable) ? (
          <div className="tw-mt-3 tw-mb-1">
            {isAdminUser ||
            isAuthDisabled ||
            userPermissions[Operation.UpdateTeam] ||
            !hasEditAccess ? (
              <div className="tw-flex">
                <label htmlFor="join-team">Allow users to join this team</label>
                <div
                  className={classNames(
                    'toggle-switch ',
                    teamJoinable ? 'open' : null
                  )}
                  data-testid="team-isJoinable-switch"
                  id="join-team"
                  onClick={() => setTeamJoinable((prev) => !prev)}>
                  <div className="switch" />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {!hideTier &&
        (isLoadingTierData ? (
          <Loader />
        ) : (
          <div className="tw-flex tw-flex-col" data-testid="cards">
            {tierData.map((card, i) => (
              <NonAdminAction
                html={
                  <>
                    <p>You need to be owner to perform this action</p>
                    <p>Claim ownership from above </p>
                  </>
                }
                isOwner={hasEditAccess || Boolean(owner && !currentUser)}
                key={i}
                permission={Operation.UpdateTags}
                position="left">
                <CardListItem
                  card={card}
                  isActive={activeTier === card.id}
                  onSelect={handleCardSelection}
                />
              </NonAdminAction>
            ))}
          </div>
        ))}
      <div className="tw-mt-6 tw-text-right" data-testid="buttons">
        <Button
          size="regular"
          theme="primary"
          variant="text"
          onClick={handleCancel}>
          Discard
        </Button>
        {loading ? (
          <Button
            disabled
            className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
            size="regular"
            theme="primary"
            variant="contained">
            <Loader size="small" type="white" />
          </Button>
        ) : status === 'success' ? (
          <Button
            disabled
            className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
            size="regular"
            theme="primary"
            variant="contained">
            <FontAwesomeIcon icon="check" />
          </Button>
        ) : (
          <Button
            className="tw-w-16 tw-h-10"
            data-testid="saveManageTab"
            size="regular"
            theme="primary"
            variant="contained"
            onClick={handleSave}>
            Save
          </Button>
        )}
      </div>
      {allowDelete ? (
        <div className="tw-mt-9" data-testid="danger-zone">
          <hr className="tw-border-main tw-mb-4" />
          <div className="tw-border tw-border-error tw-px-4 tw-py-2 tw-flex tw-justify-between tw-rounded tw-mt-3 tw-shadow">
            <div data-testid="danger-zone-text">
              <h4 className="tw-text-base" data-testid="danger-zone-text-title">
                Delete {entityType} {entityName}
              </h4>
              <p data-testid="danger-zone-text-para">
                {`Once you delete this ${entityType}, it would be removed permanently`}
              </p>
            </div>
            <Button
              className="tw-px-2 tw-py-0 tw-rounded tw-h-8 tw-self-center tw-shadow"
              data-testid="delete-button"
              size="custom"
              theme="primary"
              type="button"
              variant="outlined"
              onClick={handleOnEntityDelete}>
              Delete this {entityType}
            </Button>
          </div>
        </div>
      ) : null}
      {getDeleteModal()}
    </div>
  );
};

export default observer(ManageTab);
