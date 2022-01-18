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

import classNames from 'classnames';
import { observer } from 'mobx-react';
import React, { useState } from 'react';
import { Button } from '../../components/buttons/Button/Button';
import Description from '../../components/common/description/Description';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import PageLayout from '../../components/containers/PageLayout';
import Loader from '../../components/Loader/Loader';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import {
  Operation,
  Rule,
} from '../../generated/entity/policies/accessControl/rule';
import { Role } from '../../generated/entity/teams/role';
import { useAuth } from '../../hooks/authHooks';
import { getActiveCatClass, isEven } from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';

const RolesData = [
  {
    name: 'data steward',
    displayName: 'Data Steward',
    description: 'description for data steward role',
    id: 'id1',
    policy: [
      {
        allow: true,
        operation: Operation.UpdateDescription,
        enabled: false,
        name: 'Update Description',
      },
      {
        allow: false,
        operation: Operation.UpdateTags,
        enabled: true,
        name: 'Update Tags',
      },
      {
        allow: true,
        operation: Operation.SuggestDescription,
        enabled: false,
        name: 'Suggest Description',
      },
      {
        allow: true,
        operation: Operation.SuggestTags,
        enabled: true,
        name: 'Suggest Tags',
      },
    ],
    users: [],
  },
  {
    name: 'data consumer',
    displayName: 'Data Consumer',
    description: 'description for data consumer role',
    id: 'id2',
    policy: [
      {
        allow: true,
        operation: Operation.UpdateDescription,
        enabled: false,
        name: 'Update Description',
      },
      {
        allow: true,
        operation: Operation.SuggestDescription,
        enabled: false,
        name: 'Suggest Description',
      },
      {
        allow: true,
        operation: Operation.SuggestTags,
        enabled: true,
        name: 'Suggest Tags',
      },
    ],
    users: [],
  },
];

interface RoleData extends Role {
  policy: Array<Rule>;
  users: Array<string>;
}

const RolesPage = () => {
  const { isAuthDisabled, isAdminUser } = useAuth();
  const [currentRole, setCurrentRole] = useState<RoleData>(RolesData[0]);
  const [error] = useState<string>('');
  const [isLoading] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<number>(1);

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
        {RolesData &&
          RolesData.map((role) => (
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
                {RolesData.length > 0 ? (
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
                    {currentTab === 1
                      ? getPolicyRules(currentRole.policy)
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
