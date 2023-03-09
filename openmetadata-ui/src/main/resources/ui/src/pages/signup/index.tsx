/*
 *  Copyright 2022 Collate.
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

import { AxiosError } from 'axios';
import { useAuthContext } from 'components/authentication/auth-provider/AuthProvider';
import { UserProfile } from 'components/authentication/auth-provider/AuthProvider.interface';
import { Button } from 'components/buttons/Button/Button';
import PageContainerV1 from 'components/containers/PageContainerV1';
import TeamsSelectable from 'components/TeamsSelectable/TeamsSelectable';
import { CookieStorage } from 'cookie-storage';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { createUser } from 'rest/userAPI';
import { getNameFromUserData } from 'utils/AuthProvider.util';
import appState from '../../AppState';
import { REDIRECT_PATHNAME, ROUTES } from '../../constants/constants';
import { CreateUser } from '../../generated/api/teams/createUser';
import { User } from '../../generated/entity/teams/user';
import jsonData from '../../jsons/en';
import { getImages } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const cookieStorage = new CookieStorage();

const Signup = () => {
  const {
    setIsSigningIn,
    jwtPrincipalClaims = [],
    authorizerConfig,
  } = useAuthContext();

  const [selectedTeams, setSelectedTeams] = useState<Array<string>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [details, setDetails] = useState({
    displayName: appState.newUser.name || '',
    ...getNameFromUserData(
      appState.newUser as UserProfile,
      jwtPrincipalClaims,
      authorizerConfig?.principalDomain
    ),
  });

  const history = useHistory();

  const createNewUser = (details: User | CreateUser) => {
    setLoading(true);
    createUser(details as CreateUser)
      .then((res) => {
        if (res) {
          appState.updateUserDetails(res);
          cookieStorage.removeItem(REDIRECT_PATHNAME);
          setIsSigningIn(false);
          history.push(ROUTES.HOME);
        } else {
          setLoading(false);
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['create-user-error']
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.persist();
    setDetails((prevState) => {
      return {
        ...prevState,
        [e.target.name]: e.target.value,
      };
    });
  };

  const onSubmitHandler = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (details.name && details.displayName) {
      createNewUser({
        ...details,
        teams: selectedTeams as Array<string>,
        profile: {
          images: getImages(appState.newUser.picture ?? ''),
        },
      });
    }
  };

  return (
    <>
      {!loading && (
        <PageContainerV1>
          <div className="tw-h-screen tw-flex tw-justify-center">
            <div className="tw-flex tw-flex-col tw-items-center signup-box">
              <div className="tw-flex tw-justify-center tw-items-center tw-my-7">
                <SVGIcons
                  alt="OpenMetadata Logo"
                  data-testid="om-logo"
                  icon={Icons.LOGO_SMALL}
                  width="50"
                />
              </div>
              <div className="tw-mb-7">
                <h4 className="tw-font-semibold" data-testid="om-heading">
                  Join <span className="tw-text-primary">OpenMetadata</span>
                </h4>
              </div>
              <div className="tw-px-8 tw-w-full">
                <form
                  action="."
                  data-testid="create-user-form"
                  method="POST"
                  onSubmit={onSubmitHandler}>
                  <div className="tw-mb-4">
                    <label
                      className="tw-block tw-text-body tw-text-grey-body tw-mb-2 required-field"
                      data-testid="full-name-label"
                      htmlFor="displayName">
                      Full name
                    </label>
                    <input
                      required
                      autoComplete="off"
                      className="tw-appearance-none tw-border tw-border-main  
                tw-rounded tw-w-full tw-py-2 tw-px-3 tw-text-grey-body  tw-leading-tight 
                focus:tw-outline-none focus:tw-border-focus hover:tw-border-hover tw-h-10"
                      data-testid="full-name-input"
                      id="displayName"
                      name="displayName"
                      placeholder="Your Full name"
                      type="text"
                      value={details.displayName}
                      onChange={onChangeHandler}
                    />
                  </div>
                  <div className="tw-mb-4">
                    <label
                      className="tw-block tw-text-body tw-text-grey-body tw-mb-2 required-field"
                      data-testid="username-label"
                      htmlFor="name">
                      Username
                    </label>
                    <input
                      readOnly
                      required
                      autoComplete="off"
                      className="tw-cursor-not-allowed tw-appearance-none tw-border tw-border-main tw-rounded tw-bg-gray-100
                    tw-w-full tw-py-2 tw-px-3 tw-text-grey-body tw-leading-tight focus:tw-outline-none focus:tw-border-focus hover:tw-border-hover tw-h-10"
                      data-testid="username-input"
                      id="name"
                      name="name"
                      placeholder="Username"
                      type="text"
                      value={details.name}
                      onChange={onChangeHandler}
                    />
                  </div>
                  <div className="tw-mb-4">
                    <label
                      className="tw-block tw-text-body tw-text-grey-body tw-mb-2 required-field"
                      data-testid="email-label"
                      htmlFor="email">
                      Email
                    </label>
                    <input
                      readOnly
                      required
                      autoComplete="off"
                      className="tw-cursor-not-allowed tw-appearance-none tw-border tw-border-main tw-rounded tw-bg-gray-100
                    tw-w-full tw-py-2 tw-px-3 tw-text-grey-body tw-leading-tight focus:tw-outline-none focus:tw-border-focus hover:tw-border-hover tw-h-10"
                      data-testid="email-input"
                      id="email"
                      name="email"
                      placeholder="Your email address"
                      type="email"
                      value={details.email}
                      onChange={onChangeHandler}
                    />
                  </div>
                  <div className="tw-mb-4">
                    <label
                      className="tw-block tw-text-body tw-text-grey-body tw-mb-2"
                      data-testid="select-team-label">
                      Select teams
                    </label>
                    <TeamsSelectable
                      filterJoinable
                      showTeamsAlert
                      onSelectionChange={setSelectedTeams}
                    />
                  </div>
                  <div className="tw-flex tw-my-7 tw-justify-end">
                    <Button
                      className="tw-text-white 
                       tw-text-sm tw-py-2 tw-px-4 tw-font-semibold tw-rounded tw-h-10 tw-justify-self-end"
                      data-testid="create-button"
                      size="regular"
                      theme="primary"
                      type="submit"
                      variant="contained">
                      Create
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </PageContainerV1>
      )}
      {loading && (
        <p
          className="tw-text-center tw-text-grey-body tw-h3 tw-flex tw-justify-center tw-items-center"
          data-testid="loading-content">
          Creating Account ....
        </p>
      )}
    </>
  );
};

export default Signup;
