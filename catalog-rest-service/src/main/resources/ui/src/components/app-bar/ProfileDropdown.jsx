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
