import { observer } from 'mobx-react';
import { Match } from 'Models';
import React, { useEffect, useState } from 'react';
import {
  NavLink,
  useHistory,
  useLocation,
  useRouteMatch,
} from 'react-router-dom';
import appState from '../../AppState';
import {
  getExplorePathWithSearch,
  // navLinkDevelop,
  navLinkSettings,
  ROUTES,
} from '../../constants/constants';
import { useAuth } from '../../hooks/authHooks';
import { userSignOut } from '../../utils/AuthUtils';
import {
  inPageSearchOptions,
  isInPageSearchAllowed,
} from '../../utils/RouterUtils';
import { activeLink, normalLink } from '../../utils/styleconstant';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import DropDown from '../dropdown/DropDown';
import { ReactComponent as IconDefaultUserProfile } from './../../assets/svg/ic-default-profile.svg';
import SearchOptions from './SearchOptions';
import Suggestions from './Suggestions';

const Appbar: React.FC = (): JSX.Element => {
  const location = useLocation();
  const history = useHistory();
  const { isAuthenticatedRoute, isSignedIn } = useAuth();
  const match: Match | null = useRouteMatch({
    path: ROUTES.EXPLORE_WITH_SEARCH,
  });
  const searchQuery = match?.params?.searchQuery;
  const [searchValue, setSearchValue] = useState(searchQuery);
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const navStyle = (value: boolean) => {
    if (value) return { color: activeLink };

    return { color: normalLink };
  };
  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);

  return (
    <>
      {isAuthenticatedRoute && isSignedIn ? (
        <div className="tw-h-14 tw-py-2 tw-px-8 tw-border-b-2 tw-border-gray-300">
          <div className="tw-flex tw-items-center tw-flex-row tw-justify-between tw-flex-nowrap">
            <div className="tw-flex tw-items-center tw-flex-row tw-justify-between tw-flex-nowrap tw-mr-auto">
              <NavLink to="/">
                <SVGIcons
                  alt="OpenMetadata Logo"
                  icon={Icons.LOGO_SMALL}
                  width="30"
                />
              </NavLink>
              <div
                className="tw-flex-none tw-relative tw-pl-3 "
                data-testid="appbar-item">
                <span className="fa fa-search tw-absolute tw-block tw-z-10 tw-w-9 tw-h-8 tw-leading-8 tw-text-center tw-pointer-events-none tw-text-gray-400" />
                <input
                  className="tw-relative search-grey tw-rounded tw-border tw-border-search tw-bg-search focus:tw-outline-none tw-pl-8 tw-py-1"
                  type="text"
                  value={searchValue || ''}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                  }}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    const target = e.target as HTMLInputElement;
                    if (e.key === 'Enter') {
                      setIsOpen(false);
                      history.push(getExplorePathWithSearch(target.value));
                    }
                  }}
                />
                {searchValue &&
                  (isInPageSearchAllowed(location.pathname) ? (
                    <SearchOptions
                      isOpen={isOpen}
                      options={inPageSearchOptions(location.pathname)}
                      searchText={searchValue}
                      selectOption={(text) => {
                        appState.inPageSearchText = text;
                      }}
                      setIsOpen={setIsOpen}
                    />
                  ) : (
                    <Suggestions
                      isOpen={isOpen}
                      searchText={searchValue}
                      setIsOpen={setIsOpen}
                    />
                  ))}
              </div>
              <div className="tw-ml-9">
                <NavLink
                  className="tw-nav focus:tw-no-underline"
                  data-testid="appbar-item"
                  style={navStyle(location.pathname.startsWith('/explore'))}
                  to={{
                    pathname: '/explore',
                  }}>
                  Explore
                </NavLink>
                <DropDown
                  dropDownList={navLinkSettings}
                  label="Settings"
                  type="link"
                />
              </div>
            </div>

            <div data-testid="dropdown-profile">
              <DropDown
                dropDownList={[
                  {
                    name: 'Logout',
                    to: '#/action-1',
                    disabled: false,
                    method: userSignOut,
                  },
                ]}
                icon={IconDefaultUserProfile}
                label=""
                type="link"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="tw-flex tw-justify-center tw-items-center tw-mt-10">
          <SVGIcons alt="OpenMetadata Logo" icon={Icons.LOGO} />
        </div>
      )}
    </>
  );
};

export default observer(Appbar);
