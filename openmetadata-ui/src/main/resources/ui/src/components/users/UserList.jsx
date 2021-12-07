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

import propTypes from 'prop-types';
import React from 'react';
import { Button, Table } from 'react-bootstrap';
import { ReactComponent as IconDefaultUserProfile } from '../../assets/svg/ic-default-profile.svg';

const UserList = ({ userList, handleClick }) => {
  return (
    <Table responsive data-testid="user-list">
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Team</th>
          <th>Timezone</th>
          <th>Action</th>
        </tr>
      </thead>
      {userList.length ? (
        <tbody>
          {userList.map((user, i) => {
            const teamList = user.team.map((obj) => {
              return obj.name;
            });
            const roleList = user.role.map((obj) => {
              return obj.name;
            });

            return (
              <tr data-testid="user" key={i}>
                <td>
                  <React.Fragment>
                    <div className="profile-image">
                      <IconDefaultUserProfile />
                    </div>
                    {user.name}
                  </React.Fragment>
                </td>
                <td>{roleList.join()}</td>
                <td>{teamList.join()}</td>
                <td>{user.timezone}</td>
                <td>
                  <Button
                    className="btn-sm"
                    variant="link"
                    onClick={() => {
                      handleClick(user);
                    }}>
                    Edit
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      ) : (
        <tbody>
          <tr style={{ textAlign: 'center' }}>
            <td colSpan="5">No Data Found</td>
          </tr>
        </tbody>
      )}
    </Table>
  );
};

UserList.propTypes = {
  userList: propTypes.arrayOf(propTypes.object),
  handleClick: propTypes.func.isRequired,
};

export default UserList;
