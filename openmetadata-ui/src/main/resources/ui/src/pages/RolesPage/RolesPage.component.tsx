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
import { compare } from 'fast-json-patch';
import { isUndefined, toLower } from 'lodash';
import { observer } from 'mobx-react';
import { FormErrorData } from 'Models';
import React, { Fragment, useEffect, useState } from 'react';
import AppState from '../../AppState';
import { useAuthContext } from '../../auth-provider/AuthProvider';
import {
  createRole,
  getPolicy,
  getRoleByName,
  getRoles,
  updatePolicy,
  updateRole,
} from '../../axiosAPIs/rolesAPI';
import { patchTeamDetail } from '../../axiosAPIs/teamsAPI';
import { getUserCounts } from '../../axiosAPIs/userAPI';
import { Button } from '../../components/buttons/Button/Button';
import Description from '../../components/common/description/Description';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import PageLayout from '../../components/containers/PageLayout';
import Loader from '../../components/Loader/Loader';
import ConfirmationModal from '../../components/Modals/ConfirmationModal/ConfirmationModal';
import FormModal from '../../components/Modals/FormModal';
import AddRuleModal from '../../components/Modals/RulesModal/AddRuleModal';
import {
  ERROR404,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import {
  Operation,
  Rule,
} from '../../generated/entity/policies/accessControl/rule';
import { Role } from '../../generated/entity/teams/role';
import { Team } from '../../generated/entity/teams/team';
import { EntityReference } from '../../generated/entity/teams/user';
import { useAuth } from '../../hooks/authHooks';
import useToastContext from '../../hooks/useToastContext';
import {
  getActiveCatClass,
  isEven,
  isUrlFriendlyName,
} from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import AddUsersModal from '../teams/AddUsersModal';
import Form from '../teams/Form';
import UserCard from '../teams/UserCard';
import { Policy } from './policy.interface';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const getActiveTabClass = (tab: number, currentTab: number) => {
  return tab === currentTab ? 'active' : '';
};

const RolesPage = () => {
  const showToast = useToastContext();
  const [roles, setRoles] = useState<Array<Role>>([]);
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const [currentRole, setCurrentRole] = useState<Role>();
  const [currentPolicy, setCurrentPolicy] = useState<Policy>();
  const [error, setError] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState<boolean>(false);
  const [isAddingRole, setIsAddingRole] = useState<boolean>(false);
  const [isAddingRule, setIsAddingRule] = useState<boolean>(false);
  const [errorData, setErrorData] = useState<FormErrorData>();
  const [isEditable, setIsEditable] = useState<boolean>(false);
  const [deletingRule, setDeletingRule] = useState<{
    rule: Rule | undefined;
    state: boolean;
  }>({ rule: undefined, state: false });

  const [editingRule, setEditingRule] = useState<{
    rule: Rule | undefined;
    state: boolean;
  }>({ rule: undefined, state: false });

  const [isSettingDefaultRole, setIsSettingDefaultRole] =
    useState<boolean>(false);
  const [userCounts, setUserCounts] = useState<number>(0);

  const [defaultRole, setDefaultRole] = useState<Role>();

  const [teamList, setTeamList] = useState<Array<Team>>([]);
  const [isAddingTeams, setIsAddingTeams] = useState<boolean>(false);

  const onNewDataChange = (data: Role, forceSet = false) => {
    if (errorData || forceSet) {
      const errData: { [key: string]: string } = {};
      if (!data.name.trim()) {
        errData['name'] = 'Name is required';
      } else if (
        !isUndefined(
          roles.find((item) => toLower(item.name) === toLower(data.name))
        )
      ) {
        errData['name'] = 'Name already exists';
      } else if (data.name.length < 1 || data.name.length > 128) {
        errData['name'] = 'Name size must be between 1 and 128';
      } else if (!isUrlFriendlyName(data.name.trim())) {
        errData['name'] = 'Special characters are not allowed';
      }
      if (!data.displayName?.trim()) {
        errData['displayName'] = 'Display name is required';
      } else if (data.displayName.length < 1 || data.displayName.length > 128) {
        errData['displayName'] = 'Display name size must be between 1 and 128';
      }
      setErrorData(errData);

      return errData;
    }

    return {};
  };

  const validateRuleData = (data: Rule, forceSet = false) => {
    if (errorData || forceSet) {
      const errData: { [key: string]: string } = {};
      if (!data.operation) {
        errData['operation'] = 'Operation is required.';
      }
      setErrorData(errData);

      return errData;
    }

    return {};
  };

  const onDescriptionEdit = (): void => {
    setIsEditable(true);
  };

  const onCancel = (): void => {
    setIsEditable(false);
  };

  const fetchPolicy = (id: string) => {
    setIsLoadingPolicy(true);
    getPolicy(
      id,
      'displayName,description,owner,policyUrl,enabled,rules,location'
    )
      .then((res: AxiosResponse) => {
        setCurrentPolicy(res.data);
      })
      .catch(() => {
        showToast({
          variant: 'error',
          body: 'Error while getting policy',
        });
      })
      .finally(() => setIsLoadingPolicy(false));
  };

  const fetchRoles = () => {
    setIsLoading(true);
    getRoles(['policy', 'users', 'teams'])
      .then((res: AxiosResponse) => {
        const { data } = res.data;
        setRoles(data);
        setDefaultRole(data.find((role: Role) => role.defaultRole));
        setCurrentRole(data[0]);
        AppState.updateUserRole(data);
      })
      .catch(() => {
        setError('Error while getting roles');
        showToast({
          variant: 'error',
          body: 'Error while getting roles',
        });
      })
      .finally(() => setIsLoading(false));
  };

  const createNewRole = (data: Role) => {
    const errData = onNewDataChange(data, true);
    const { description, name, displayName } = data;
    if (!Object.values(errData).length) {
      createRole({
        description: description as string,
        name,
        displayName: displayName as string,
      })
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchRoles();
          }
        })
        .catch((error: AxiosError) => {
          showToast({
            variant: 'error',
            body: error.message ?? 'Something went wrong!',
          });
        })
        .finally(() => {
          setIsAddingRole(false);
        });
    }
  };

  const fetchCurrentRole = (name: string, update = false) => {
    if (currentRole?.name !== name || update) {
      setIsLoading(true);
      getRoleByName(name, ['users', 'policy', 'teams'])
        .then((res: AxiosResponse) => {
          setCurrentRole(res.data);
          setRoles((pre) => {
            return pre.map((role) => {
              if (role.id === res.data.id) {
                return { ...res.data };
              } else {
                return role;
              }
            });
          });
          if (roles.length <= 0) {
            fetchRoles();
          }
        })
        .catch((err: AxiosError) => {
          if (err?.response?.data.code) {
            setError(ERROR404);
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    if (currentRole?.description !== updatedHTML) {
      const updatedRole = { ...currentRole, description: updatedHTML };
      const jsonPatch = compare(currentRole as Role, updatedRole);
      updateRole(currentRole?.id as string, jsonPatch).then(
        (res: AxiosResponse) => {
          if (res.data) {
            fetchCurrentRole(res.data.name, true);
          }
        }
      );

      setIsEditable(false);
    } else {
      setIsEditable(false);
    }
  };

  const startSetDefaultRole = () => {
    setIsSettingDefaultRole(true);
  };

  const cancelSetDefaultRole = () => {
    setIsSettingDefaultRole(false);
  };

  const addTeams = (data: Team[]) => {
    const currentRoleReference: EntityReference = {
      id: currentRole?.id as string,
      type: 'role',
    };
    const teamsPatchCall = data.map((team) => {
      const updatedTeam = {
        ...team,
        defaultRoles: [
          ...(team.defaultRoles as EntityReference[]),
          currentRoleReference,
        ],
      };
      const patch = compare(team, updatedTeam);

      return patchTeamDetail(team.id, patch);
    });
    Promise.all(teamsPatchCall)
      .then(() => {
        setIsAddingTeams(false);
        fetchCurrentRole(currentRole?.name as string, true);
      })
      .catch(() => {
        showToast({
          variant: 'error',
          body: 'Error while adding teams to the role',
        });
      })
      .finally(() => {
        setIsAddingTeams(false);
      });
  };

  const onSetDefaultRole = () => {
    if (isSettingDefaultRole) {
      const updatedRole = { ...currentRole, defaultRole: true };
      const jsonPatch = compare(currentRole as Role, updatedRole);
      updateRole(currentRole?.id as string, jsonPatch)
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchCurrentRole(res.data.name, true);
            setRoles((pre) => {
              return pre.map((role) => ({
                ...role,
                defaultRole: false,
              }));
            });
          }
        })
        .catch(() => {
          showToast({
            variant: 'error',
            body: 'Error while setting role as default.',
          });
        })
        .finally(() => {
          cancelSetDefaultRole();
        });
    }
  };

  const createRule = (data: Rule) => {
    const errData = validateRuleData(data, true);
    if (!Object.values(errData).length) {
      const newRule = {
        ...data,
        name: `${currentPolicy?.name}-${data.operation}`,
        userRoleAttr: currentRole?.name,
      };
      const updatedPolicy = {
        name: currentPolicy?.name as string,
        policyType: currentPolicy?.policyType as string,
        rules: [...(currentPolicy?.rules as Rule[]), newRule],
      };

      updatePolicy(updatedPolicy)
        .then((res: AxiosResponse) => {
          setCurrentPolicy(res.data);
        })
        .catch((err: AxiosError) => {
          showToast({
            variant: 'error',
            body: err.response?.data?.message ?? 'Error while adding new rule',
          });
        })
        .finally(() => setIsAddingRule(false));
    }
  };

  const onRuleUpdate = (data: Rule) => {
    const rules = currentPolicy?.rules?.map((rule) => {
      if (rule.name === data.name) {
        return data;
      } else {
        return rule;
      }
    });

    const updatedPolicy = {
      name: currentPolicy?.name as string,
      policyType: currentPolicy?.policyType as string,
      rules: rules as Rule[],
    };
    updatePolicy(updatedPolicy)
      .then((res: AxiosResponse) => {
        setCurrentPolicy(res.data);
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body:
            err.response?.data?.message ??
            `Error while updating ${data.name} rule`,
        });
      })
      .finally(() => setEditingRule({ rule: undefined, state: false }));
  };

  const deleteRule = (data: Rule) => {
    const updatedPolicy = {
      name: currentPolicy?.name as string,
      policyType: currentPolicy?.policyType as string,
      rules: currentPolicy?.rules?.filter(
        (rule) => rule.operation !== data.operation
      ) as Rule[],
    };
    updatePolicy(updatedPolicy)
      .then((res: AxiosResponse) => {
        setCurrentPolicy(res.data);
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.response?.data?.message ?? 'Error while deleting rule',
        });
      })
      .finally(() => {
        setDeletingRule({ rule: undefined, state: false });
      });
  };

  const getDefaultBadge = (className?: string) => {
    return (
      <span
        className={classNames(
          'tw-border tw-border-grey-muted tw-rounded tw-px-1 tw-font-normal tw-text-sm',
          className
        )}>
        Default
      </span>
    );
  };

  const getTabs = () => {
    return (
      <div className="tw-mb-3 ">
        <nav
          className="tw-flex tw-flex-row tw-gh-tabs-container"
          data-testid="tabs">
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(
              1,
              currentTab
            )}`}
            data-testid="policy"
            onClick={() => {
              setCurrentTab(1);
            }}>
            Policy
          </button>
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(
              2,
              currentTab
            )}`}
            data-testid="teams"
            onClick={() => {
              setCurrentTab(2);
            }}>
            Teams
          </button>
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(
              3,
              currentTab
            )}`}
            data-testid="users"
            onClick={() => {
              setCurrentTab(3);
            }}>
            Users
          </button>
        </nav>
      </div>
    );
  };

  const fetchLeftPanel = (roles: Array<Role>) => {
    return (
      <>
        <div className="tw-flex tw-justify-between tw-items-center tw-mb-3 tw-border-b">
          <h6
            className="tw-heading tw-text-base"
            data-testid="left-panel-title">
            Roles
          </h6>
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
            <Button
              className={classNames('tw-h-7 tw-px-2 tw-mb-4', {
                'tw-opacity-40': !isAdminUser && !isAuthDisabled,
              })}
              data-testid="add-role"
              size="small"
              theme="primary"
              variant="contained"
              onClick={() => {
                setErrorData(undefined);
                setIsAddingRole(true);
              }}>
              <FontAwesomeIcon icon="plus" />
            </Button>
          </NonAdminAction>
        </div>
        {roles &&
          roles.map((role) => (
            <div
              className={`tw-group tw-text-grey-body tw-cursor-pointer tw-text-body tw-mb-3 tw-flex tw-justify-between ${getActiveCatClass(
                role.name,
                currentRole?.name
              )}`}
              data-testid="role-name-container"
              key={role.name}
              onClick={() => setCurrentRole(role)}>
              <p
                className="tag-category label-category tw-self-center tw-truncate tw-w-52"
                title={role.displayName}>
                <span>{role.displayName}</span>{' '}
              </p>
              {role.defaultRole ? getDefaultBadge() : null}
            </div>
          ))}
      </>
    );
  };

  const getPolicyRules = (rules: Array<Rule>) => {
    if (!rules.length) {
      return (
        <div className="tw-text-center tw-py-5">
          <p className="tw-text-base">No rules.</p>
        </div>
      );
    }

    return (
      <div className="tw-bg-white">
        <table className="tw-w-full tw-overflow-x-auto" data-testid="table">
          <thead>
            <tr className="tableHead-row">
              <th className="tableHead-cell" data-testid="table-heading">
                Operation
              </th>
              <th className="tableHead-cell" data-testid="table-heading">
                Access
              </th>
              <th className="tableHead-cell" data-testid="table-heading">
                Enabled
              </th>
              <th className="tableHead-cell" data-testid="table-heading">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="tw-text-sm" data-testid="table-body">
            {rules.map((rule, index) => (
              <tr
                className={`tableBody-row ${!isEven(index + 1) && 'odd-row'}`}
                key={index}>
                <td className="tableBody-cell">
                  <p>{rule.operation}</p>
                </td>
                <td className="tableBody-cell">
                  <p
                    className={classNames(
                      rule.allow
                        ? 'tw-text-status-success'
                        : 'tw-text-status-failed'
                    )}>
                    {rule.allow ? 'ALLOW' : 'DENY'}
                  </p>
                </td>
                <td className="tableBody-cell">
                  <div
                    className={classNames(
                      'toggle-switch tw-ml-4',
                      rule.enabled ? 'open' : null
                    )}
                    data-testid="rule-switch"
                    onClick={() =>
                      onRuleUpdate({ ...rule, enabled: !rule.enabled })
                    }>
                    <div className="switch" />
                  </div>
                </td>
                <td className="tableBody-cell">
                  <div className="tw-flex">
                    <span onClick={() => setEditingRule({ rule, state: true })}>
                      <SVGIcons
                        alt="icon-edit"
                        className="tw-cursor-pointer"
                        icon="icon-edit"
                        title="Edit"
                        width="12"
                      />
                    </span>
                    <span
                      onClick={() => setDeletingRule({ rule, state: true })}>
                      <SVGIcons
                        alt="icon-delete"
                        className="tw-ml-4 tw-cursor-pointer"
                        icon="icon-delete"
                        title="Delete"
                        width="12"
                      />
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const getRoleUsers = (users: Array<EntityReference>) => {
    if (!users.length) {
      return (
        <div className="tw-text-center tw-py-5">
          <p className="tw-text-base">No Users Added.</p>
        </div>
      );
    }

    return (
      <div className="tw-grid tw-grid-cols-4 tw-gap-4">
        {users.map((user) => (
          <UserCard
            isIconVisible
            item={{
              description: (user.displayName ?? user.name) as string,
              name: user.name as string,
              id: user.id,
            }}
            key={user.id}
          />
        ))}
      </div>
    );
  };

  const getRoleTeams = (teams: Array<EntityReference>) => {
    const AddTeamButton = () => (
      <div className="tw-flex tw-justify-end tw-mr-1">
        <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
          <Button
            className={classNames('tw-h-8 tw-rounded tw-mb-3', {
              'tw-opacity-40': !isAdminUser && !isAuthDisabled,
            })}
            data-testid="add-teams-button"
            size="small"
            theme="primary"
            variant="contained"
            onClick={() => setIsAddingTeams(true)}>
            Add teams
          </Button>
        </NonAdminAction>
      </div>
    );
    if (!teams.length) {
      return (
        <div className="tw-text-center tw-py-5">
          <AddTeamButton />
          <p className="tw-text-base">No Teams Added.</p>
        </div>
      );
    }

    return (
      <Fragment>
        <div className="tw-flex tw-justify-between">
          <p>
            {currentRole?.displayName ?? currentRole?.name} role is assigned to
            all users who are part of following teams.
          </p>
          <AddTeamButton />
        </div>
        <div
          className="tw-grid xxl:tw-grid-cols-4 md:tw-grid-cols-3 tw-gap-4"
          data-testid="teams-card">
          {teams.map((team, i) => {
            const teamData = {
              description: team.displayName || team.name || '',
              name: team.name as string,
              id: team.id,
            };

            return <UserCard isIconVisible item={teamData} key={i} />;
          })}
        </div>
      </Fragment>
    );
  };

  const fetchUserCounts = () => {
    getUserCounts()
      .then((res: AxiosResponse) => {
        setUserCounts(res.data.hits.total.value);
      })
      .catch(() => {
        showToast({
          variant: 'error',
          body: 'Error while getting users count.',
        });
      });
  };

  const getUniqueTeamList = () => {
    const currentRoleTeams = currentRole?.teams ?? [];

    return teamList.filter(
      (team) => !currentRoleTeams.some((cTeam) => cTeam.id === team.id)
    );
  };

  useEffect(() => {
    fetchRoles();
    fetchUserCounts();
  }, []);

  useEffect(() => {
    setTeamList(AppState.userTeams as Team[]);
  }, [AppState.userTeams]);

  useEffect(() => {
    if (currentRole) {
      fetchPolicy(currentRole?.policy?.id as string);
    }
  }, [currentRole]);

  return (
    <>
      {error ? (
        <ErrorPlaceHolder />
      ) : (
        <PageContainerV1 className="tw-py-4">
          <PageLayout leftPanel={fetchLeftPanel(roles)}>
            {isLoading ? (
              <Loader />
            ) : (
              <div className="tw-pb-3" data-testid="role-container">
                {roles.length > 0 ? (
                  <>
                    <div
                      className="tw-flex tw-justify-between tw-items-center"
                      data-testid="header">
                      <div
                        className="tw-heading tw-text-link tw-text-base"
                        data-testid="header-title">
                        {currentRole?.displayName}
                        {currentRole?.defaultRole
                          ? getDefaultBadge('tw-ml-2')
                          : null}
                      </div>
                      <div className="tw-flex">
                        {!currentRole?.defaultRole ? (
                          <NonAdminAction
                            position="bottom"
                            title={TITLE_FOR_NON_ADMIN_ACTION}>
                            <Button
                              className={classNames(
                                'tw-h-8 tw-rounded tw-mb-3 tw-mr-2',
                                {
                                  'tw-opacity-40':
                                    !isAdminUser && !isAuthDisabled,
                                }
                              )}
                              data-testid="set-as-default-button"
                              size="small"
                              theme="primary"
                              variant="contained"
                              onClick={startSetDefaultRole}>
                              Set as default
                            </Button>
                          </NonAdminAction>
                        ) : null}
                        <NonAdminAction
                          position="bottom"
                          title={TITLE_FOR_NON_ADMIN_ACTION}>
                          <Button
                            className={classNames('tw-h-8 tw-rounded tw-mb-3', {
                              'tw-opacity-40': !isAdminUser && !isAuthDisabled,
                            })}
                            data-testid="add-new-rule-button"
                            size="small"
                            theme="primary"
                            variant="contained"
                            onClick={() => {
                              setErrorData(undefined);
                              setIsAddingRule(true);
                            }}>
                            Add new rule
                          </Button>
                        </NonAdminAction>
                      </div>
                    </div>
                    <div
                      className="tw-mb-3 tw--ml-5"
                      data-testid="description-container">
                      <Description
                        blurWithBodyBG
                        description={currentRole?.description || ''}
                        entityName={currentRole?.displayName}
                        isEdit={isEditable}
                        onCancel={onCancel}
                        onDescriptionEdit={onDescriptionEdit}
                        onDescriptionUpdate={onDescriptionUpdate}
                      />
                    </div>
                    {getTabs()}
                    {currentTab === 1 ? (
                      <Fragment>
                        {isLoadingPolicy ? (
                          <Loader />
                        ) : (
                          <>{getPolicyRules(currentPolicy?.rules ?? [])}</>
                        )}
                      </Fragment>
                    ) : null}
                    {currentTab === 2
                      ? getRoleTeams(currentRole?.teams ?? [])
                      : null}
                    {currentTab === 3
                      ? getRoleUsers(currentRole?.users ?? [])
                      : null}
                  </>
                ) : (
                  <ErrorPlaceHolder>
                    <p className="w-text-lg tw-text-center">No Roles Added.</p>
                    <p className="w-text-lg tw-text-center">
                      <NonAdminAction
                        position="bottom"
                        title={TITLE_FOR_NON_ADMIN_ACTION}>
                        <Button
                          size="small"
                          theme="primary"
                          variant="outlined"
                          onClick={() => {
                            setErrorData(undefined);
                            setIsAddingRole(true);
                          }}>
                          Click here
                        </Button>
                        {' to add new Role'}
                      </NonAdminAction>
                    </p>
                  </ErrorPlaceHolder>
                )}
                {isAddingRole && (
                  <FormModal
                    errorData={errorData}
                    form={Form}
                    header="Adding new role"
                    initialData={{
                      name: '',
                      description: '',
                      displayName: '',
                    }}
                    onCancel={() => setIsAddingRole(false)}
                    onChange={(data) => onNewDataChange(data as Role)}
                    onSave={(data) => createNewRole(data as Role)}
                  />
                )}
                {isAddingRule && (
                  <AddRuleModal
                    errorData={errorData}
                    header={`Adding new rule for ${toLower(
                      currentRole?.displayName
                    )}`}
                    initialData={
                      { name: '', operation: '' as Operation } as Rule
                    }
                    onCancel={() => setIsAddingRule(false)}
                    onChange={(data) => validateRuleData(data as Rule)}
                    onSave={createRule}
                  />
                )}

                {editingRule.state && (
                  <AddRuleModal
                    isEditing
                    header={`Edit rule ${editingRule.rule?.name}`}
                    initialData={editingRule.rule as Rule}
                    onCancel={() =>
                      setEditingRule({ rule: undefined, state: false })
                    }
                    onSave={onRuleUpdate}
                  />
                )}

                {deletingRule.state && (
                  <ConfirmationModal
                    bodyText={`Are you sure want to delete ${deletingRule.rule?.name}?`}
                    cancelText="Cancel"
                    confirmText="Confirm"
                    header="Deleting rule"
                    onCancel={() =>
                      setDeletingRule({ rule: undefined, state: false })
                    }
                    onConfirm={() => {
                      deleteRule(deletingRule.rule as Rule);
                    }}
                  />
                )}

                {isSettingDefaultRole && (
                  <ConfirmationModal
                    bodyText={
                      <Fragment>
                        {userCounts} users will be assigned{' '}
                        <span className="tw-font-medium">
                          {currentRole?.displayName ?? currentRole?.name}
                        </span>{' '}
                        role and unassigned{' '}
                        <span className="tw-font-medium">
                          {defaultRole?.displayName ?? defaultRole?.name}
                        </span>{' '}
                        role.
                      </Fragment>
                    }
                    cancelText="Cancel"
                    confirmText="Confirm"
                    header={`Set ${currentRole?.name} as default role`}
                    onCancel={cancelSetDefaultRole}
                    onConfirm={onSetDefaultRole}
                  />
                )}
                {isAddingTeams && (
                  <AddUsersModal
                    header={`Adding teams to ${
                      currentRole?.displayName ?? currentRole?.name
                    } role`}
                    list={getUniqueTeamList() as EntityReference[]}
                    searchPlaceHolder="Search for teams..."
                    onCancel={() => setIsAddingTeams(false)}
                    onSave={(data) => addTeams(data as Team[])}
                  />
                )}
              </div>
            )}
          </PageLayout>
        </PageContainerV1>
      )}
    </>
  );
};

export default observer(RolesPage);
