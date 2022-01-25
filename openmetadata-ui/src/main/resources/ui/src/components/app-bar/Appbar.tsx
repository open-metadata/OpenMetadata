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
import { CookieStorage } from 'cookie-storage';
import { isEmpty } from 'lodash';
import { observer } from 'mobx-react';
import { Match } from 'Models';
import React, { useEffect, useState } from 'react';
import { Link, useHistory, useLocation, useRouteMatch } from 'react-router-dom';
import appState from '../../AppState';
import { getVersion } from '../../axiosAPIs/miscAPI';
import {
  getExplorePathWithSearch,
  getTeamDetailsPath,
  navLinkSettings,
  ROUTES,
} from '../../constants/constants';
import { urlGitbookDocs, urlJoinSlack } from '../../constants/url.const';
import { useAuth } from '../../hooks/authHooks';
import { userSignOut } from '../../utils/AuthUtils';
import { addToRecentSearched } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { COOKIE_VERSION } from '../Modals/WhatsNewModal/whatsNewData';
import NavBar from '../nav-bar/NavBar';

const cookieStorage = new CookieStorage();

const Appbar: React.FC = (): JSX.Element => {
  const location = useLocation();
  const history = useHistory();
  const {
    isAuthenticatedRoute,
    isSignedIn,
    isFirstTimeUser,
    isAuthDisabled,
    isTourRoute,
  } = useAuth(location.pathname);
  const match: Match | null = useRouteMatch({
    path: ROUTES.EXPLORE_WITH_SEARCH,
  });
  const searchQuery = match?.params?.searchQuery;
  const [searchValue, setSearchValue] = useState(searchQuery);
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState<boolean>(false);

  const [version, setVersion] = useState<string>('');

  const handleFeatureModal = (value: boolean) => {
    setIsFeatureModalOpen(value);
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  const supportLinks = [
    {
      name: (
        <span>
          <SVGIcons
            alt="API icon"
            className="tw-align-middle tw--mt-0.5 tw-mr-0.5"
            icon={Icons.VERSION_BLACK}
            width="12"
          />{' '}
          <span className="tw-text-grey-muted">{`Version ${
            (version ? version : '?').split('-')[0]
          }`}</span>
        </span>
      ),
      to: '',
      disabled: false,
      icon: <></>,
      isText: true,
    },
    {
      name: `Docs`,
      to: urlGitbookDocs,
      isOpenNewTab: true,
      disabled: false,
      icon: (
        <SVGIcons
          alt="Doc icon"
          className="tw-align-middle tw--mt-0.5 tw-mr-0.5"
          icon={Icons.DOC}
          width="12"
        />
      ),
    },
    {
      name: `API`,
      to: ROUTES.SWAGGER,
      disabled: false,
      icon: (
        <SVGIcons
          alt="API icon"
          className="tw-align-middle tw--mt-0.5 tw-mr-0.5"
          icon={Icons.API}
          width="12"
        />
      ),
    },
    {
      name: `Slack`,
      to: urlJoinSlack,
      disabled: false,
      isOpenNewTab: true,
      icon: (
        <SVGIcons
          alt="slack icon"
          className="tw-align-middle tw-mr-0.5"
          icon={Icons.SLACK_GREY}
          width="12"
        />
      ),
    },
  ];

  const getUserData = () => {
    const currentUser = isAuthDisabled
      ? appState.users[0]
      : appState.userDetails;

    const name = currentUser?.displayName || currentUser?.name || 'User';

    const roles = currentUser?.roles;

    const teams = currentUser?.teams;

    return (
      <div data-testid="greeting-text">
        <span className="tw-font-medium">{name}</span>
        <hr className="tw-my-1.5" />
        {(roles?.length ?? 0) > 0 ? (
          <div>
            <div className="tw-font-medium tw-text-xs">Roles</div>
            {roles?.map((r, i) => (
              <p className="tw-text-grey-muted" key={i}>
                {r.displayName}
              </p>
            ))}
          </div>
        ) : null}
        <hr className="tw-my-1.5" />
        {(teams?.length ?? 0) > 0 ? (
          <div>
            <span className="tw-font-medium tw-text-xs">Teams</span>
            {teams?.map((t, i) => (
              <p key={i}>
                <Link to={getTeamDetailsPath(t.name as string)}>
                  {t.displayName}
                </Link>
              </p>
            ))}
            <hr className="tw-mt-1.5" />
          </div>
        ) : null}
      </div>
    );
  };

  const profileDropdown = [
    {
      name: getUserData(),
      to: '',
      disabled: false,
      icon: <></>,
      isText: true,
    },
    {
      name: 'Logout',
      to: '#/action-1',
      disabled: false,
      method: userSignOut,
    },
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    if (e.key === 'Enter') {
      setIsOpen(false);

      addToRecentSearched(target.value);
      history.push(
        getExplorePathWithSearch(
          target.value,
          // this is for if user is searching from another page
          location.pathname.startsWith(ROUTES.EXPLORE)
            ? appState.explorePageTab
            : 'tables'
        )
      );
    }
  };

  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    setIsFeatureModalOpen(
      // TODO: Add !isFirstTimeUser to condition if showing Welcome Modal
      cookieStorage.getItem(COOKIE_VERSION) !== 'true'
    );
  }, [isFirstTimeUser]);

  useEffect(() => {
    if (isAuthDisabled) {
      getVersion().then((res: AxiosResponse) => {
        setVersion(res.data.version);
      });
    } else {
      if (!isEmpty(appState.userDetails)) {
        getVersion().then((res: AxiosResponse) => {
          setVersion(res.data.version);
        });
      }
    }
  }, [appState.userDetails, isAuthDisabled]);

  return (
    <>
      {isAuthenticatedRoute && isSignedIn && !isTourRoute ? (
        <NavBar
          handleFeatureModal={handleFeatureModal}
          handleKeyDown={handleKeyDown}
          handleSearchBoxOpen={setIsOpen}
          handleSearchChange={handleSearchChange}
          isFeatureModalOpen={isFeatureModalOpen}
          isSearchBoxOpen={isOpen}
          pathname={location.pathname}
          profileDropdown={profileDropdown}
          searchValue={searchValue || ''}
          settingDropdown={navLinkSettings}
          supportDropdown={supportLinks}
        />
      ) : null}
    </>
  );
};

export default observer(Appbar);
