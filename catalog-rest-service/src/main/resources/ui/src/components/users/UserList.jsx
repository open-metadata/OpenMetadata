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
