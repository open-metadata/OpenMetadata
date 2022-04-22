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
import { EntityType } from '../../enums/entity.enum';
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
import ToggleSwitchV1 from '../common/toggle-switch/ToggleSwitchV1';
import DropDownList from '../dropdown/DropDownList';
import Loader from '../Loader/Loader';
import EntityDeleteModal from '../Modals/EntityDeleteModal/EntityDeleteModal';
import DeleteWidgetBody from './DeleteWidgetBody';
import { ManageProps, Status } from './ManageTab.interface';

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
  allowSoftDelete,
  isRecursiveDelete,
  deletEntityMessage,
  handleIsJoinable,
}: ManageProps) => {
  const history = useHistory();
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
  const [entityDeleteState, setEntityDeleteState] =
    useState<typeof ENTITY_DELETE_STATE>(ENTITY_DELETE_STATE);

  const getOwnerById = (): string => {
    return listOwners.find((item) => item.value === owner)?.name || '';
  };

  const getOwnerGroup = () => {
    return allowTeamOwner ? ['Teams', 'Users'] : ['Users'];
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
        onSave(newOwner, '', Boolean(teamJoinable)).catch(() => {
          setInitialOwnerLoadingState();
        });
      } else {
        setInitialOwnerLoadingState();
      }
    } else {
      const newTier = prepareTier(updatedTier);
      onSave(newOwner, newTier, Boolean(teamJoinable)).catch(() => {
        setInitialOwnerLoadingState();
      });
    }
  };

  const handleTierSave = (updatedTier: string) => {
    setStatusTier('waiting');
    const newOwner: TableDetail['owner'] = prepareOwner(currentUser);
    if (hideTier) {
      if (newOwner || !isUndefined(teamJoinable)) {
        onSave(newOwner, '', Boolean(teamJoinable)).catch(() => {
          setInitialTierLoadingState();
        });
      } else {
        setInitialTierLoadingState();
      }
    } else {
      const newTier = prepareTier(updatedTier);
      onSave(newOwner, newTier, Boolean(teamJoinable)).catch(() => {
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

  const handleOnEntityDelete = (softDelete = false) => {
    setEntityDeleteState((prev) => ({ ...prev, state: true, softDelete }));
  };

  const handleOnEntityDeleteCancel = () => {
    setEntityDeleteState(ENTITY_DELETE_STATE);
  };

  const prepareEntityType = () => {
    const services = [
      EntityType.DASHBOARD_SERVICE,
      EntityType.DATABASE_SERVICE,
      EntityType.MESSAGING_SERVICE,
      EntityType.PIPELINE_SERVICE,
    ];

    if (services.includes((entityType || '') as EntityType)) {
      return `services/${entityType}s`;
    } else {
      return `${entityType}s`;
    }
  };

  const prepareDeleteMessage = (softDelete = false) => {
    const softDeleteText = `Soft deleting will deactivate the ${entityName}. This will disable any discovery, read or write operations on ${entityName}`;
    const hardDeleteText = `Once you delete this ${entityType}, it will be removed permanently`;

    return softDelete ? softDeleteText : hardDeleteText;
  };

  const handleOnEntityDeleteConfirm = () => {
    setEntityDeleteState((prev) => ({ ...prev, loading: 'waiting' }));
    deleteEntity(
      prepareEntityType(),
      entityId,
      isRecursiveDelete,
      allowSoftDelete
    )
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
          bodyText={
            deletEntityMessage ||
            prepareDeleteMessage(entityDeleteState.softDelete)
          }
          entityName={entityName as string}
          entityType={entityType as string}
          loadingState={entityDeleteState.loading}
          softDelete={entityDeleteState.softDelete}
          onCancel={handleOnEntityDeleteCancel}
          onConfirm={handleOnEntityDeleteConfirm}
        />
      );
    } else {
      return null;
    }
  };

  const getDeleteEntityWidget = () => {
    return allowDelete && entityId && entityName && entityType ? (
      <div className="tw-mt-1" data-testid="danger-zone">
        <hr className="tw-border-main tw-mb-4" />
        <div className="tw-border tw-border-error tw-rounded tw-mt-3 tw-shadow">
          {allowSoftDelete && (
            <div className="tw-border-b">
              <DeleteWidgetBody
                buttonText="Soft delete"
                description={prepareDeleteMessage(true)}
                hasPermission={isAdminUser || isAuthDisabled}
                header={`Soft delete ${entityType} ${entityName}`}
                isOwner={isAdminUser}
                onClick={() => handleOnEntityDelete(true)}
              />
            </div>
          )}

          <DeleteWidgetBody
            buttonText="Delete"
            description={prepareDeleteMessage()}
            hasPermission={isAdminUser || isAuthDisabled}
            header={`Delete ${entityType} ${entityName}`}
            isOwner={isAdminUser}
            onClick={handleOnEntityDelete}
          />
        </div>
      </div>
    ) : null;
  };

  const getTierCards = () => {
    if (!hideTier) {
      return isLoadingTierData ? (
        <Loader />
      ) : (
        <div className="tw-flex tw-flex-col" data-testid="cards">
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
                isActive={activeTier === card.id}
                isSelected={card.id === currentTier}
                tierStatus={statusTier}
                onSave={handleTierSave}
                onSelect={handleCardSelection}
              />
            </NonAdminAction>
          ))}
        </div>
      );
    } else {
      return null;
    }
  };

  const getJoinableWidget = () => {
    const isActionAllowed =
      isAdminUser ||
      isAuthDisabled ||
      userPermissions[Operation.UpdateTeam] ||
      !hasEditAccess;

    const joinableSwitch =
      isActionAllowed && !isUndefined(teamJoinable) ? (
        <div className="tw-flex">
          <label htmlFor="join-team">Open to join</label>
          <ToggleSwitchV1
            checked={teamJoinable}
            handleCheck={() => {
              handleIsJoinable?.(!teamJoinable);
            }}
          />
        </div>
      ) : null;

    return !isUndefined(isJoinable) ? (
      <div className="tw-mt-3 tw-mb-1">{joinableSwitch}</div>
    ) : null;
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

  const getOwnerUpdateLoader = () => {
    return (
      <span className="tw-ml-4">
        {statusOwner === 'waiting' ? (
          <Loader
            className="tw-inline-block"
            size="small"
            style={{ marginBottom: '-4px' }}
            type="default"
          />
        ) : statusOwner === 'success' ? (
          <FontAwesomeIcon icon="check" />
        ) : null}
      </span>
    );
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
          'tw-border-b tw-border-separator tw-mb-4': !hideTier,
        })}>
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
            {getOwnerUpdateLoader()}
          </span>
        </div>
        {getJoinableWidget()}
      </div>
      {getTierCards()}
      {getDeleteEntityWidget()}
      {getDeleteModal()}
    </div>
  );
};

export default observer(ManageTab);
