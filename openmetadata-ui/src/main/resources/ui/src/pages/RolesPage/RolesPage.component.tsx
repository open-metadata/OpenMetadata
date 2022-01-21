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

import { AxiosResponse } from 'axios';
import classNames from 'classnames';
import { observer } from 'mobx-react';
import React, { Fragment, useEffect, useState } from 'react';
import { getPolicy, getRoles } from '../../axiosAPIs/rolesAPI';
import { Button } from '../../components/buttons/Button/Button';
import Description from '../../components/common/description/Description';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import PageLayout from '../../components/containers/PageLayout';
import Loader from '../../components/Loader/Loader';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { Rule } from '../../generated/entity/policies/accessControl/rule';
import { Role } from '../../generated/entity/teams/role';
import { EntityReference } from '../../generated/entity/teams/user';
import { useAuth } from '../../hooks/authHooks';
import useToastContext from '../../hooks/useToastContext';
import { getActiveCatClass, isEven } from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import UserCard from '../teams/UserCard';

const RolesPage = () => {
  const showToast = useToastContext();
  const [roles, setRoles] = useState<Array<Role>>([]);
  const { isAuthDisabled, isAdminUser } = useAuth();
  const [currentRole, setCurrentRole] = useState<Role>();
  const [currentPolicy, setCurrentPolicy] = useState<{ rules: Array<Rule> }>();
  const [error, setError] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState<boolean>(false);

  const getActiveTabClass = (tab: number) => {
    return tab === currentTab ? 'active' : '';
  };

  const getTabs = () => {
    return (
      <div className="tw-mb-3 ">
        <nav
          className="tw-flex tw-flex-row tw-gh-tabs-container"
          data-testid="tabs">
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(1)}`}
            data-testid="users"
            onClick={() => {
              setCurrentTab(1);
            }}>
            Policy
          </button>
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(2)}`}
            data-testid="assets"
            onClick={() => {
              setCurrentTab(2);
            }}>
            Users
          </button>
        </nav>
      </div>
    );
  };

  const fetchLeftPanel = () => {
    return (
      <>
        <div className="tw-flex tw-justify-between tw-items-center tw-mb-3 tw-border-b">
          <h6 className="tw-heading tw-text-base">Roles</h6>
          <Button
            className={classNames('tw-h-7 tw-px-2 tw-mb-4')}
            data-testid="add-roles"
            size="small"
            theme="primary"
            variant="contained">
            <i aria-hidden="true" className="fa fa-plus" />
          </Button>
        </div>
        {roles.map((role) => (
          <div
            className={`tw-group tw-text-grey-body tw-cursor-pointer tw-text-body tw-mb-3 tw-flex tw-justify-between ${getActiveCatClass(
              role.name,
              currentRole?.name
            )}`}
            key={role.name}
            onClick={() => setCurrentRole(role)}>
            <p
              className="tag-category label-category tw-self-center tw-truncate tw-w-52"
              title={role.displayName}>
              {role.displayName}
            </p>
          </div>
        ))}
      </>
    );
  };

  const getPolicyRules = (rules: Array<Rule>) => {
    if (!rules.length) {
      return (
        <div className="tw-text-center tw-py-5">
          <p className="tw-text-base">No Rules Added.</p>
        </div>
      );
    }

    return (
      <div className="tw-bg-white">
        <table className="tw-w-full tw-overflow-x-auto" data-testid="table">
          <thead>
            <tr className="tableHead-row">
              <th className="tableHead-cell" data-testid="heading-description">
                Operation
              </th>
              <th className="tableHead-cell" data-testid="heading-description">
                Access
              </th>
              <th className="tableHead-cell" data-testid="heading-description">
                Enabled
              </th>
              <th className="tableHead-cell" data-testid="heading-description">
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
                      { 'tw-text-status-success': rule.allow },
                      { 'tw-text-status-failed': !rule.allow }
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
                    data-testid="rule-switch">
                    <div className="switch" />
                  </div>
                </td>
                <td className="tableBody-cell">
                  <div className="tw-flex">
                    <SVGIcons
                      alt="icon-edit"
                      className="tw-cursor-pointer"
                      icon="icon-edit"
                      title="Edit"
                      width="12"
                    />
                    <SVGIcons
                      alt="icon-delete"
                      className="tw-ml-4 tw-cursor-pointer"
                      icon="icon-delete"
                      title="Delete"
                      width="12"
                    />
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
    return (
      <div className="tw-grid tw-grid-cols-4 tw-gap-x-2">
        {users.map((user) => (
          <UserCard
            isIconVisible
            item={{
              description: user.displayName as string,
              name: user.name as string,
              id: user.id,
            }}
            key={user.id}
          />
        ))}
      </div>
    );
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
    getRoles(['policy', 'users'])
      .then((res: AxiosResponse) => {
        const { data } = res.data;
        setRoles(data);
        setCurrentRole(data[0]);
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

  useEffect(() => {
    fetchRoles();
  }, []);

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
          <PageLayout leftPanel={fetchLeftPanel()}>
            {isLoading ? (
              <Loader />
            ) : (
              <div className="tw-pb-3" data-testid="role-container">
                {roles.length > 0 ? (
                  <>
                    <div
                      className="tw-flex tw-justify-between tw-items-center"
                      data-testid="header">
                      <div className="tw-heading tw-text-link tw-text-base">
                        {currentRole?.displayName}
                      </div>
                      <NonAdminAction
                        position="bottom"
                        title={TITLE_FOR_NON_ADMIN_ACTION}>
                        <Button
                          className={classNames('tw-h-8 tw-rounded tw-mb-3', {
                            'tw-opacity-40': !isAdminUser && !isAuthDisabled,
                          })}
                          data-testid="add-new-user-button"
                          size="small"
                          theme="primary"
                          variant="contained">
                          Add new rule
                        </Button>
                      </NonAdminAction>
                    </div>
                    <div
                      className="tw-mb-3 tw--ml-5"
                      data-testid="description-container">
                      <Description
                        description={currentRole?.description || ''}
                        entityName={currentRole?.displayName}
                        isEdit={false}
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
                      ? getRoleUsers(currentRole?.users ?? [])
                      : null}
                  </>
                ) : (
                  <ErrorPlaceHolder>
                    <p className="w-text-lg tw-text-center">No Roles Added.</p>
                    <p className="w-text-lg tw-text-center">
                      <button className="link-text tw-underline">
                        Click here
                      </button>
                      {' to add new Role'}
                    </p>
                  </ErrorPlaceHolder>
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
