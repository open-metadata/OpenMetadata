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
import React from 'react';
import { User } from '../../../generated/entity/teams/user';
import { Button } from '../../buttons/Button/Button';
import Avatar from '../../common/avatar/Avatar';
type UserDetailsModalProp = {
  userData: User;
  onCancel: () => void;
  onSave: () => void;
  header: string;
};

const UserDetailsModal = ({
  userData,
  onCancel,
  onSave,
  header,
}: UserDetailsModalProp) => {
  return (
    <dialog className="tw-modal" data-testid="modal-container">
      <div className="tw-modal-backdrop" onClick={() => onCancel()} />
      <div className="tw-modal-container tw-overflow-y-auto tw-max-w-lg tw-max-h-screen">
        <div className="tw-modal-header">
          <p className="tw-modal-title tw-text-grey-body" data-testid="header">
            {header}
          </p>
        </div>
        <div className="tw-modal-body">
          <div className="tw-flex tw-flex-col tw-items-center">
            {userData.profile?.images?.image ? (
              <div className="tw-h-28 tw-w-28">
                <img
                  alt="profile"
                  className="tw-rounded-full tw-w-full"
                  src={userData.profile?.images?.image}
                />
              </div>
            ) : (
              <Avatar
                name={userData?.displayName || userData.name}
                textClass="tw-text-5xl"
                width="112"
              />
            )}
            <p className="tw-mt-2 tw-mb-1">
              <span className="tw-text-base tw-font-medium tw-mr-2">
                {userData.displayName || userData.name}
              </span>
              <span
                className={classNames(
                  'tw-text-xs tw-border tw-px-1 tw-py-0.5 tw-rounded',
                  userData.deactivated
                    ? 'tw-border-grey-muted'
                    : 'tw-border-success'
                )}>
                {userData.deactivated ? (
                  <span className="tw-text-grey-muted">Inactive</span>
                ) : (
                  <span className="tw-text-success">Active</span>
                )}
              </span>
            </p>
            <p className="tw-mb-1">
              <span className="tw-mr-1">{userData.name}</span>|
              <span className="tw-ml-1">{userData.email}</span>
            </p>
            <p className="tw-mb-4 tw-font-normal">
              Role: {userData.isAdmin ? 'Admin' : 'User'}
            </p>
            {userData.teams && <div className="tw-filter-seperator tw-w-5/6" />}
            <p className="tw-w-4/5 tw-mx-auto">
              <span className="tw-flex tw-justify-center tw-flex-wrap">
                {userData.teams && userData.teams.length > 0 ? (
                  userData.teams.map((team, i) => (
                    <p
                      className="tw-bg-gray-200 tw-rounded tw-px-1 tw-text-grey-body tw-m-0.5"
                      key={i}>
                      {team.name}
                    </p>
                  ))
                ) : (
                  <p>This user is not a part of any team!</p>
                )}
              </span>
            </p>
          </div>
        </div>
        <div className="tw-modal-footer" data-testid="cta-container">
          <Button
            size="regular"
            theme="primary"
            variant="link"
            onClick={onCancel}>
            Cancel
          </Button>
          <Button
            data-testid="saveButton"
            size="regular"
            theme="primary"
            type="submit"
            variant="contained"
            onClick={onSave}>
            {userData.isAdmin ? 'Revoke Admin Privileges' : 'Make Admin'}
          </Button>
        </div>
      </div>
    </dialog>
  );
};

export default UserDetailsModal;
