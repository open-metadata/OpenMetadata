import { AxiosResponse } from 'axios';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getUserByName } from '../../axiosAPIs/userAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import Loader from '../../components/Loader/Loader';
import Users from '../../components/Users/Users.component';
import { User } from '../../generated/entity/teams/user';

const UserPage = () => {
  const { username } = useParams<{ [key: string]: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<User>({} as User);
  const [isError, setIsError] = useState(false);

  const fetchUserData = () => {
    getUserByName(username, 'profile,roles,teams,follows,owns')
      .then((res: AxiosResponse) => {
        setUserData(res.data);
      })
      .catch(() => {
        setIsError(true);
      })
      .finally(() => setIsLoading(false));
  };

  const errorPlaceholder = () => {
    return (
      <div className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1">
        <p className="tw-text-base">
          No user available with{' '}
          <span className="tw-font-medium">{username}</span> username.
        </p>
      </div>
    );
  };

  useEffect(() => {
    fetchUserData();
  }, [username]);

  return (
    <PageContainerV1 className="tw-pt-4">
      {isLoading ? (
        <Loader />
      ) : !isError ? (
        <Users userData={userData} />
      ) : (
        errorPlaceholder()
      )}
    </PageContainerV1>
  );
};

export default UserPage;
