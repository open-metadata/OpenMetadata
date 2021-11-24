import appState from '../AppState';
import { getUserDetails, getUsers } from '../axiosAPIs/userAPI';

const fetchUserDetails = async (userId) => {
  const promiseArr = [];
  if (userId) {
    promiseArr.push(getUserDetails(userId));
  } else {
    if (appState.users.users?.length) {
      appState.users.map((user) => {
        user.instance?.id && promiseArr.push(getUserDetails(user.instance.id));

        return user;
      });
    } else {
      await getUsers().then((res) => {
        appState.users = res.data.data;
        appState.users.map((user) => {
          user.instance?.id &&
            promiseArr.push(getUserDetails(user.instance.id));

          return user;
        });
      });
    }
  }

  return Promise.all(promiseArr).then((results) => {
    const userList = [];
    results.map((result) => {
      const userDetails = { role: [], team: [] };
      userDetails.name = result.data.displayName;
      userDetails.timezone = result.data.timezone;
      userDetails.id = result.data.instance?.id;
      result.data.roles.map((role) => {
        userDetails.role.push({ name: role.name, id: role.id });

        return role.name;
      });
      result.data.teams.map((team) => {
        userDetails.team.push({ name: team.name, id: team.id });

        return team.name;
      });
      userList.push(userDetails);

      return userDetails;
    });

    return userList;
  });
};

export default fetchUserDetails;
