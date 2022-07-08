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

import { Card } from 'antd';
import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isUndefined, toLower } from 'lodash';
import { observer } from 'mobx-react';
import { FormErrorData } from 'Models';
import React, { Fragment, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import AppState from '../../AppState';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import {
  createRole,
  getPolicies,
  getPolicy,
  getRoleByName,
  getRoles,
  updatePolicy,
  updateRole,
} from '../../axiosAPIs/rolesAPI';
import { getTeams, patchTeamDetail } from '../../axiosAPIs/teamsAPI';
import { getUserCounts } from '../../axiosAPIs/userAPI';
import { Button } from '../../components/buttons/Button/Button';
import Description from '../../components/common/description/Description';
import Ellipses from '../../components/common/Ellipses/Ellipses';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import PageLayout, {
  leftPanelAntCardStyle,
} from '../../components/containers/PageLayout';
import Loader from '../../components/Loader/Loader';
import ConfirmationModal from '../../components/Modals/ConfirmationModal/ConfirmationModal';
import AddRoleModal from '../../components/Modals/RoleModal/AddRoleModal';
import AddRuleModal from '../../components/Modals/RulesModal/AddRuleModal';
import {
  getUserPath,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import { DEFAULT_UPDATE_POLICY_STATE } from '../../constants/role.constants';
import {
  Operation,
  Rule,
} from '../../generated/entity/policies/accessControl/rule';
import { Role } from '../../generated/entity/teams/role';
import { Team } from '../../generated/entity/teams/team';
import { EntityReference } from '../../generated/entity/teams/user';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import {
  getActiveCatClass,
  getEntityName,
  isEven,
  isUrlFriendlyName,
} from '../../utils/CommonUtils';
import { getErrorText } from '../../utils/StringsUtils';
import SVGIcons from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import AddUsersModal from '../teams/AddUsersModal';
import Form from '../teams/Form';
import UserCard from '../teams/UserCard';
import { Policy, UpdatePolicyState } from './role.interface';

const getActiveTabClass = (tab: number, currentTab: number) => {
  return tab === currentTab ? 'active' : '';
};

const RolesPage = () => {
  const [roles, setRoles] = useState<Array<Role>>([]);
  const history = useHistory();
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const [currentRole, setCurrentRole] = useState<Role>();
  const [currentRolePolicies, setCurrentRolePolicies] = useState<Policy[]>([]);
  const [error, setError] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState<boolean>(false);
  const [isAddingRole, setIsAddingRole] = useState<boolean>(false);
  const [isAddingRule, setIsAddingRule] = useState<UpdatePolicyState>(
    DEFAULT_UPDATE_POLICY_STATE
  );
  const [errorData, setErrorData] = useState<FormErrorData>();
  const [isEditable, setIsEditable] = useState<boolean>(false);
  const [deletingRule, setDeletingRule] = useState<UpdatePolicyState>(
    DEFAULT_UPDATE_POLICY_STATE
  );

  const [editingRule, setEditingRule] = useState<UpdatePolicyState>(
    DEFAULT_UPDATE_POLICY_STATE
  );

  const [isSettingDefaultRole, setIsSettingDefaultRole] =
    useState<boolean>(false);
  const [userCounts, setUserCounts] = useState<number>(0);

  const [defaultRole, setDefaultRole] = useState<Role>();

  const [teamList, setTeamList] = useState<Array<Team>>([]);
  const [isAddingTeams, setIsAddingTeams] = useState<boolean>(false);

  const [defaultPolicies, setDefaultPolicies] = useState<Array<Policy>>([]);

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

      if (!data.policies?.length) {
        errData['policies'] =
          'At least one policy is required to create a role';
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
        if (res.data) {
          setCurrentRolePolicies((preV) => [...preV, res.data]);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-policy-error']
        );
      })
      .finally(() => setIsLoadingPolicy(false));
  };

  const fetchRoles = () => {
    setIsLoading(true);
    getRoles(['policies', 'users', 'teams'])
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { data } = res.data;
          setRoles(data);
          setDefaultRole(data.find((role: Role) => role.defaultRole));
          setCurrentRole(data[0]);
          AppState.updateUserRole(data);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['fetch-roles-error']
        );
        showErrorToast(errMsg);
        setError(errMsg);
      })
      .finally(() => setIsLoading(false));
  };

  const fetchTeams = () => {
    getTeams('defaultRoles')
      .then((res: AxiosResponse) => {
        if (res.data) {
          setTeamList(res.data.data);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-teams-error']
        );
      });
  };

  const createNewRole = (data: Role) => {
    const errData = onNewDataChange(data, true);
    const { description, name, displayName, policies } = data;
    if (!Object.values(errData).length) {
      createRole({
        description: description || '',
        name,
        displayName: displayName || '',
        policies: policies || [],
      })
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchRoles();
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['create-role-error']
          );
        })
        .finally(() => {
          setIsAddingRole(false);
        });
    }
  };

  const fetchCurrentRole = (name: string, update = false) => {
    if (currentRole?.name !== name || update) {
      setIsLoading(true);
      getRoleByName(name, ['users', 'policies', 'teams'])
        .then((res: AxiosResponse) => {
          if (res.data) {
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
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          const errMsg = getErrorText(
            err,
            jsonData['api-error-messages']['fetch-roles-error']
          );
          showErrorToast(errMsg);
          setError(errMsg);
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
      updateRole(currentRole?.id || '', jsonPatch)
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchCurrentRole(res.data.name, true);
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['update-role-error']
          );
        })
        .finally(() => {
          setIsEditable(false);
        });
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

  const addTeamsToRole = (data: Team[]) => {
    const currentRoleReference: EntityReference = {
      id: currentRole?.id || '',
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
        fetchCurrentRole(currentRole?.name || '', true);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-role-error']
        );
      })
      .finally(() => {
        setIsAddingTeams(false);
      });
  };

  const onSetDefaultRole = () => {
    if (isSettingDefaultRole) {
      const updatedRole = { ...currentRole, defaultRole: true };
      const jsonPatch = compare(currentRole as Role, updatedRole);
      updateRole(currentRole?.id || '', jsonPatch)
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchCurrentRole(res.data.name, true);
            setRoles((pre) => {
              return pre.map((role) => ({
                ...role,
                defaultRole: false,
              }));
            });
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['update-role-error']
          );
        })
        .finally(() => {
          cancelSetDefaultRole();
        });
    }
  };

  const createRule = (data: Rule) => {
    const errData = validateRuleData(data, true);
    const updatingPolicy = isAddingRule.policy;
    if (!Object.values(errData).length && !isUndefined(updatingPolicy)) {
      const newRule = {
        ...data,
        name: `${updatingPolicy?.name}-${data.operation}`,
      };
      const updatedPolicy = {
        name: updatingPolicy?.name || '',
        policyType: updatingPolicy?.policyType || '',
        rules: [...(updatingPolicy?.rules || []), newRule],
      };

      updatePolicy(updatedPolicy)
        .then((res: AxiosResponse) => {
          if (res.data) {
            setCurrentRolePolicies((prevPolicies) => {
              return prevPolicies.map((preVPolicy) => {
                if (updatingPolicy?.id === preVPolicy.id) {
                  return res.data;
                } else {
                  return preVPolicy;
                }
              });
            });
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['create-rule-error']
          );
        })
        .finally(() => setIsAddingRule(DEFAULT_UPDATE_POLICY_STATE));
    }
  };

  const updateRule = (data: Rule) => {
    const editingPolicy = editingRule.policy;

    if (!isUndefined(editingPolicy)) {
      const rules = editingPolicy?.rules?.map((rule) => {
        if (rule.name === data.name) {
          return data;
        } else {
          return rule;
        }
      });

      const updatedPolicy = {
        name: editingPolicy?.name || '',
        policyType: editingPolicy?.policyType || '',
        rules: rules || [],
      };

      updatePolicy(updatedPolicy)
        .then((res: AxiosResponse) => {
          if (res.data) {
            setCurrentRolePolicies((previousPolicies) => {
              return previousPolicies.map((preVPolicy) => {
                if (editingPolicy?.id === preVPolicy.id) {
                  return res.data;
                } else {
                  return preVPolicy;
                }
              });
            });
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(err, `Error while updating ${data.name} rule`);
        })
        .finally(() => setEditingRule(DEFAULT_UPDATE_POLICY_STATE));
    }
  };

  const deleteRule = (data: Rule) => {
    const updatingPolicy = deletingRule.policy;
    if (!isUndefined(updatingPolicy)) {
      const updatedPolicy = {
        name: updatingPolicy?.name || '',
        policyType: updatingPolicy?.policyType || '',
        rules:
          updatingPolicy?.rules?.filter(
            (rule) => rule.operation !== data.operation
          ) || [],
      };
      updatePolicy(updatedPolicy)
        .then((res: AxiosResponse) => {
          if (res.data) {
            setCurrentRolePolicies((policies) => {
              return policies.map((prevPolicy) => {
                if (updatingPolicy?.id === prevPolicy.id) {
                  return res.data;
                } else {
                  return prevPolicy;
                }
              });
            });
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['delete-rule-error']
          );
        })
        .finally(() => {
          setDeletingRule(DEFAULT_UPDATE_POLICY_STATE);
        });
    }
  };

  /**
   * Redirects user to profile page.
   * @param name user name
   */
  const handleUserRedirection = (name: string) => {
    history.push(getUserPath(name));
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
            data-testid="policies"
            onClick={() => {
              setCurrentTab(1);
            }}>
            Policies
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
      <Card
        data-testid="data-summary-container"
        style={leftPanelAntCardStyle}
        title={
          <div className="tw-flex tw-justify-between tw-items-center">
            <h6
              className="tw-heading tw-text-base tw-mb-0"
              data-testid="left-panel-title">
              Roles
            </h6>
          </div>
        }>
        <Fragment>
          {roles &&
            roles.map((role) => (
              <div
                className={`tw-group tw-text-grey-body tw-cursor-pointer tw-text-body tw-my-2 tw-flex tw-justify-between ${getActiveCatClass(
                  role.name,
                  currentRole?.name
                )}`}
                data-testid="role-name-container"
                key={role.name}
                onClick={() => setCurrentRole(role)}>
                <Ellipses
                  tooltip
                  className="tag-category label-category tw-self-center tw-w-52"
                  rows={1}>
                  <span>{role.displayName}</span>{' '}
                </Ellipses>
                {role.defaultRole ? getDefaultBadge() : null}
              </div>
            ))}
        </Fragment>
      </Card>
    );
  };

  const getRolePolicy = (policyObj: Policy) => {
    const rules = policyObj.rules ?? [];

    const addNewRuleButton = (
      <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
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
            setIsAddingRule({ state: true, policy: policyObj });
          }}>
          Add new rule
        </Button>
      </NonAdminAction>
    );

    if (!rules.length) {
      return (
        <div className="tw-text-center tw-py-5">
          <div className="tw-flex tw-justify-between tw-items-center tw-mb-2">
            <div className="">
              <h6>{getEntityName(policyObj as unknown as EntityReference)}</h6>
            </div>
            {addNewRuleButton}
          </div>
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
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="tw-text-sm" data-testid="table-body">
                <tr className="tableBody-row">
                  <td className="tableBody-cell tw-text-center" colSpan={3}>
                    <p>No rules.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <Fragment>
        <div className="tw-flex tw-justify-between tw-items-center">
          <div className="">
            <h6>{getEntityName(policyObj as unknown as EntityReference)}</h6>
          </div>
          {addNewRuleButton}
        </div>
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
                    <div className="tw-flex">
                      <span
                        onClick={() =>
                          setEditingRule({
                            rule,
                            state: true,
                            policy: policyObj,
                          })
                        }>
                        <SVGIcons
                          alt="icon-edit"
                          className="tw-cursor-pointer"
                          icon="icon-edit"
                          title="Edit"
                          width="12"
                        />
                      </span>
                      <span
                        onClick={() =>
                          setDeletingRule({
                            rule,
                            state: true,
                            policy: policyObj,
                          })
                        }>
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
      </Fragment>
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
              displayName: getEntityName(user),
              fqn: user.fullyQualifiedName || '',
              id: user.id,
              type: user.type,
              name: user.name,
            }}
            key={user.id}
            onTitleClick={handleUserRedirection}
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
              displayName: team.displayName || team.name || '',
              fqn: team.fullyQualifiedName || '',
              id: team.id,
              type: team.type,
              name: team.name,
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
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-user-count-error']
        );
      });
  };

  const getUniqueTeamList = () => {
    const currentRoleTeams = currentRole?.teams ?? [];

    return teamList.filter(
      (team) => !currentRoleTeams.some((cTeam) => cTeam.id === team.id)
    );
  };

  const getAddRoleForm = () => {
    return isAddingRole ? (
      <AddRoleModal
        errorData={errorData}
        form={Form}
        header="Adding new role"
        initialData={{
          name: '',
          description: '',
          displayName: '',
          policies: defaultPolicies as unknown as EntityReference[],
        }}
        onCancel={() => setIsAddingRole(false)}
        onChange={(data) => onNewDataChange(data as Role)}
        onSave={(data) => createNewRole(data as Role)}
      />
    ) : null;
  };

  const getAddRuleForm = () => {
    return isAddingRule.state ? (
      <AddRuleModal
        errorData={errorData}
        header={`Adding new rule for ${getEntityName(
          isAddingRule.policy as unknown as EntityReference
        )}`}
        initialData={{ name: '', operation: '' as Operation } as Rule}
        onCancel={() => setIsAddingRule(DEFAULT_UPDATE_POLICY_STATE)}
        onChange={(data) => validateRuleData(data as Rule)}
        onSave={createRule}
      />
    ) : null;
  };

  const getEditRuleModal = () => {
    return editingRule.state ? (
      <AddRuleModal
        isEditing
        header={`Edit rule ${editingRule.rule?.name}`}
        initialData={editingRule.rule as Rule}
        onCancel={() => setEditingRule(DEFAULT_UPDATE_POLICY_STATE)}
        onSave={updateRule}
      />
    ) : null;
  };

  const getDeleteRuleModal = () => {
    return deletingRule.state ? (
      <ConfirmationModal
        bodyText={`Are you sure want to delete ${deletingRule.rule?.name}?`}
        cancelText="Cancel"
        confirmText="Confirm"
        header="Deleting rule"
        onCancel={() => setDeletingRule(DEFAULT_UPDATE_POLICY_STATE)}
        onConfirm={() => {
          deleteRule(deletingRule.rule as Rule);
        }}
      />
    ) : null;
  };

  const getSetDefaultRoleModal = () => {
    return isSettingDefaultRole ? (
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
    ) : null;
  };

  const getAddTeamModal = () => {
    return isAddingTeams ? (
      <AddUsersModal
        header={`Adding teams to ${
          currentRole?.displayName ?? currentRole?.name
        } role`}
        list={getUniqueTeamList() as EntityReference[]}
        searchPlaceHolder="Search for teams..."
        onCancel={() => setIsAddingTeams(false)}
        onSave={(data) => addTeamsToRole(data as Team[])}
      />
    ) : null;
  };

  const getErrorPlaceHolder = () => {
    return (
      <ErrorPlaceHolder>
        <p className="w-text-lg tw-text-center">No Roles Added.</p>
        <p className="w-text-lg tw-text-center">
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
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
    );
  };

  const getRolesComponent = () => {
    return (
      <Fragment>
        <div className="tw-flex tw-justify-between" data-testid="header">
          <div className="tw-flex tw-items-start tw-max-w-75">
            <Ellipses
              tooltip
              className="tw-heading tw-text-link tw-text-base"
              data-testid="header-title">
              {currentRole?.displayName}
            </Ellipses>
            {currentRole?.defaultRole ? getDefaultBadge('tw-ml-2') : null}
          </div>
          <div className="tw-flex tw-items-start">
            {!currentRole?.defaultRole ? (
              <NonAdminAction
                position="bottom"
                title={TITLE_FOR_NON_ADMIN_ACTION}>
                <Button
                  className={classNames('tw-h-8 tw-rounded tw-mb-3 tw-mr-2', {
                    'tw-opacity-40': !isAdminUser && !isAuthDisabled,
                  })}
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
                className={classNames('tw-h-8 tw-px-2 tw-mb-4', {
                  'tw-opacity-40': !isAdminUser && !isAuthDisabled,
                })}
                data-testid="add-new-role-button"
                size="small"
                theme="primary"
                variant="contained"
                onClick={() => {
                  setErrorData(undefined);
                  setIsAddingRole(true);
                }}>
                Add new role
              </Button>
            </NonAdminAction>
          </div>
        </div>
        <div className="tw-mb-3 tw--ml-5" data-testid="description-container">
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
              <Fragment>
                {currentRolePolicies.map((policy, index) => (
                  <div className="tw-mb-6" key={index}>
                    {getRolePolicy(policy)}
                  </div>
                ))}
              </Fragment>
            )}
          </Fragment>
        ) : null}
        {currentTab === 2 ? getRoleTeams(currentRole?.teams ?? []) : null}
        {currentTab === 3 ? getRoleUsers(currentRole?.users ?? []) : null}
      </Fragment>
    );
  };

  const getRolesContainer = () => {
    return roles.length > 0 ? getRolesComponent() : getErrorPlaceHolder();
  };

  const fetchCurrentRolePolicies = () => {
    if (currentRole) {
      currentRole?.policies?.forEach((policy) => {
        fetchPolicy(policy.id);
      });
    }
  };

  const fetchDefualtPolicies = () => {
    getPolicies()
      .then((res: AxiosResponse) => {
        if (res.data) {
          setDefaultPolicies(res.data.data);
        } else {
          setDefaultPolicies([]);
        }
      })
      .catch((error: AxiosError) => {
        showErrorToast(error);
      });
  };

  useEffect(() => {
    fetchRoles();
    fetchTeams();
    fetchUserCounts();
    fetchDefualtPolicies();
  }, []);

  useEffect(() => {
    setCurrentRolePolicies([]);
    fetchCurrentRolePolicies();
  }, [currentRole]);

  return (
    <Fragment>
      {error ? (
        <ErrorPlaceHolder>{error}</ErrorPlaceHolder>
      ) : (
        <PageContainerV1 className="tw-py-4">
          <PageLayout leftPanel={fetchLeftPanel(roles)}>
            {isLoading ? (
              <Loader />
            ) : (
              <div
                className="tw-pb-3"
                data-testid="role-container"
                style={{ padding: '14px' }}>
                {getRolesContainer()}

                {getAddRoleForm()}

                {getAddRuleForm()}

                {getEditRuleModal()}

                {getDeleteRuleModal()}

                {getSetDefaultRoleModal()}

                {getAddTeamModal()}
              </div>
            )}
          </PageLayout>
        </PageContainerV1>
      )}
    </Fragment>
  );
};

export default observer(RolesPage);
