import _ from 'lodash';
import React, { useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import Pagination from 'react-js-pagination';
import {
  getRoles,
  getTeams,
  updateUserRole,
  updateUserTeam,
} from '../../axiosAPIs/userAPI';
import PageContainer from '../../components/containers/PageContainer';
import Edituser from '../../components/users/Edituser';
import UserList from '../../components/users/UserList';
import fetchUserDetails from '../../utils/UserUtils';

const UsersPage = () => {
  const [userList, setUserList] = useState([]);
  const [splitData, setSplitData] = useState([]);
  const [rolesList, setRolesList] = useState([]);
  const [teamsList, setTeamsList] = useState([]);
  const [pageIndex, setPageIndex] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [modal, setModal] = useState(false);
  const [user, setUser] = useState({});
  const pageSize = 15;

  const fetchData = async () => {
    const data = await fetchUserDetails();
    const promiseArr = [getRoles(), getTeams()];
    Promise.all(promiseArr).then((result) => {
      setRolesList(result[0].data);
      setTeamsList(result[1].data);
    });
    const splitData = _.chunk(data, pageSize) || [];
    setUserList(data.length > pageSize ? splitData[0] : data);
    setSplitData(splitData);
    setTotalUsers(data.length);
  };

  const handlePageChange = (index) => {
    setPageIndex(index);
    setUserList(splitData[index - 1]);
  };

  const handleClick = (user) => {
    setUser(user);
    setModal(true);
  };

  const handleClose = () => {
    setModal(false);
  };

  const handleSave = (userId, selectedRole, selectedTeam) => {
    const rolesObj = { roles: [] };
    const teamObj = { teams: [] };
    selectedRole.map((obj) => {
      rolesObj.roles.push(obj.value);

      return obj;
    });
    selectedTeam.map((obj) => {
      teamObj.teams.push(obj.value);

      return obj;
    });
    const promiseArr = [
      updateUserRole(userId, rolesObj),
      updateUserTeam(userId, teamObj),
    ];

    Promise.all(promiseArr).then(async () => {
      const editedUser = await fetchUserDetails(userId);

      const updatedList = userList.map((users) => {
        if (users.id === editedUser[0].id) {
          return editedUser[0];
        } else {
          return users;
        }
      });
      const splitData = _.chunk(updatedList, pageSize) || [];
      setUserList(updatedList.length > pageSize ? splitData[0] : updatedList);
      setModal(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <PageContainer>
      <h1 data-testid="header">User List</h1>
      <UserList handleClick={(user) => handleClick(user)} userList={userList} />

      <div className="pagination" data-testid="pagination">
        {userList.length ? (
          <Pagination
            hideNavigation
            activePage={pageIndex}
            itemsCountPerPage={pageSize}
            pageRangeDisplayed={5}
            totalItemsCount={totalUsers}
            onChange={(index) => handlePageChange(index)}
          />
        ) : null}
      </div>

      <Modal show={modal} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Edit User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Edituser
            handleSave={(id, selectedTeam, selectedRole) =>
              handleSave(id, selectedTeam, selectedRole)
            }
            rolesList={rolesList}
            teamsList={teamsList}
            user={user}
          />
        </Modal.Body>
      </Modal>
    </PageContainer>
  );
};

export default UsersPage;
