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

import PropTypes from 'prop-types';
import React from 'react';
import { Dropdown } from 'react-bootstrap';
import { ReactComponent as IconDefaultUserProfile } from './../../assets/svg/ic-default-profile.svg';

const ProfileDropdown = ({ name, imgSrc }) => {
  return (
    <Dropdown className="d-inline-block">
      <Dropdown.Toggle
        className="user-dropdown"
        data-testid="dropdown-profile"
        id="dropdown-profile">
        <div className="profile-image">
          {imgSrc ? (
            <img alt={name} className="" src={imgSrc} />
          ) : (
            <IconDefaultUserProfile />
          )}
        </div>
        {/* <span>{name}</span> */}
      </Dropdown.Toggle>

      <Dropdown.Menu>
        <Dropdown.Item href="#/action-1">Logout</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
};

ProfileDropdown.propTypes = {
  name: PropTypes.string.isRequired,
  imgSrc: PropTypes.string,
};

export default ProfileDropdown;
