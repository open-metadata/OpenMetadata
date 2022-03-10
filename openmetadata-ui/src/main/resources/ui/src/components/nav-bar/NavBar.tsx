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

import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import AppState from '../../AppState';
import { ROUTES } from '../../constants/constants';
import {
  inPageSearchOptions,
  isInPageSearchAllowed,
} from '../../utils/RouterUtils';
import { activeLink, normalLink } from '../../utils/styleconstant';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import SearchOptions from '../app-bar/SearchOptions';
import Suggestions from '../app-bar/Suggestions';
import Avatar from '../common/avatar/Avatar';
import PopOver from '../common/popover/PopOver';
import DropDown from '../dropdown/DropDown';
import { WhatsNewModal } from '../Modals/WhatsNewModal';
import { NavBarProps } from './NavBar.interface';

const NavBar = ({
  settingDropdown,
  supportDropdown,
  profileDropdown,
  searchValue,
  isFeatureModalOpen,
  isTourRoute = false,
  pathname,
  username,
  isSearchBoxOpen,
  handleSearchBoxOpen,
  handleFeatureModal,
  handleSearchChange,
  handleKeyDown,
  handleOnClick,
}: NavBarProps) => {
  const [searchIcon, setSearchIcon] = useState<string>('icon-searchv1');
  const navStyle = (value: boolean) => {
    if (value) return { color: activeLink };

    return { color: normalLink };
  };

  return (
    <>
      <div className="tw-h-16 tw-py-3 tw-border-b-2 tw-border-separator">
        <div className="tw-flex tw-items-center tw-flex-row tw-justify-between tw-flex-nowrap tw-px-6 centered-layout">
          <div className="tw-flex tw-items-center tw-flex-row tw-justify-between tw-flex-nowrap">
            <NavLink className="tw-flex-shrink-0" id="openmetadata_logo" to="/">
              <SVGIcons alt="OpenMetadata Logo" icon={Icons.LOGO} width="90" />
            </NavLink>
            <div className="tw-ml-5">
              <NavLink
                className="tw-nav focus:tw-no-underline"
                data-testid="appbar-item"
                id="explore"
                style={navStyle(pathname.startsWith('/explore'))}
                to={{
                  pathname: '/explore/tables',
                }}>
                Explore
              </NavLink>
              <DropDown
                dropDownList={settingDropdown}
                label="Settings"
                type="link"
              />
            </div>
          </div>
          <div
            className="tw-flex-none tw-relative tw-justify-items-center tw-ml-auto"
            data-testid="appbar-item">
            <span
              className="tw-cursor-pointer tw-absolute tw-right-2.5 tw-top-2 tw-block tw-z-40 tw-w-4 tw-h-4 tw-text-center"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleOnClick();
              }}>
              <SVGIcons alt="icon-search" icon={searchIcon} />
            </span>
            <input
              autoComplete="off"
              className="tw-relative search-grey tw-rounded tw-border tw-border-main focus:tw-outline-none tw-pl-2 tw-pt-2 tw-pb-1.5 tw-form-inputs tw-ml-4"
              data-testid="searchBox"
              id="searchBox"
              placeholder="Search for Table, Topics, Dashboards and Pipeline"
              type="text"
              value={searchValue}
              onBlur={() => setSearchIcon('icon-searchv1')}
              onChange={(e) => {
                handleSearchChange(e.target.value);
              }}
              onFocus={() => setSearchIcon('icon-searchv1color')}
              onKeyDown={handleKeyDown}
            />
            {!isTourRoute &&
              searchValue &&
              (isInPageSearchAllowed(pathname) ? (
                <SearchOptions
                  isOpen={isSearchBoxOpen}
                  options={inPageSearchOptions(pathname)}
                  searchText={searchValue}
                  selectOption={(text) => {
                    AppState.inPageSearchText = text;
                  }}
                  setIsOpen={handleSearchBoxOpen}
                />
              ) : (
                <Suggestions
                  isOpen={isSearchBoxOpen}
                  searchText={searchValue}
                  setIsOpen={handleSearchBoxOpen}
                />
              ))}
          </div>
          <div className="tw-flex tw-ml-auto tw-pl-36">
            <button
              className="tw-nav focus:tw-no-underline hover:tw-underline tw-flex-shrink-0"
              data-testid="whatsnew-modal"
              onClick={() => handleFeatureModal(true)}>
              <SVGIcons
                alt="Doc icon"
                className="tw-align-middle tw-mr-1"
                icon={Icons.WHATS_NEW}
                width="20"
              />
            </button>
            <button
              className="tw-nav focus:tw-no-underline hover:tw-underline tw-flex-shrink-0"
              data-testid="tour">
              <Link to={ROUTES.TOUR}>
                <SVGIcons
                  alt="tour icon"
                  className="tw-align-middle tw-mr-0.5"
                  icon={Icons.TOUR}
                  width="20"
                />
              </Link>
            </button>
            <div className="tw-flex-shrink-0">
              <DropDown
                dropDownList={supportDropdown}
                icon={
                  <SVGIcons
                    alt="Doc icon"
                    className="tw-align-middle tw-mt-0.5 tw-mr-1"
                    icon={Icons.HELP_CIRCLE}
                    width="20"
                  />
                }
                isDropDownIconVisible={false}
                isLableVisible={false}
                label="Need Help"
                type="link"
              />
            </div>
          </div>
          <div data-testid="dropdown-profile">
            <DropDown
              dropDownList={profileDropdown}
              icon={
                <>
                  <PopOver
                    position="bottom"
                    title="Profile"
                    trigger="mouseenter">
                    {AppState?.userDetails?.profile?.images?.image512 ? (
                      <div className="profile-image tw--mr-2">
                        <img
                          alt="user"
                          src={AppState.userDetails.profile.images.image512}
                        />
                      </div>
                    ) : (
                      <Avatar name={username} width="30" />
                    )}
                  </PopOver>
                </>
              }
              isDropDownIconVisible={false}
              type="link"
            />
          </div>
        </div>
        {isFeatureModalOpen && (
          <WhatsNewModal
            header="What’s new!"
            onCancel={() => handleFeatureModal(false)}
          />
        )}
      </div>
    </>
  );
};

export default NavBar;
