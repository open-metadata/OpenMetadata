import PropTypes from 'prop-types';
import React from 'react';
import { ReactComponent as IconDefaultUserProfile } from './../../assets/svg/ic-default-profile.svg';

const ProfileIcon = ({ imgSrc, title }) => {
  return (
    <>
      {imgSrc ? (
        <img
          alt={title}
          className=""
          data-testid="image-profile"
          src={imgSrc}
        />
      ) : (
        <IconDefaultUserProfile data-testid="svg-profile" title={title} />
      )}
    </>
  );
};

ProfileIcon.defaultProps = {
  imgSrc: null,
  title: '',
};

ProfileIcon.propTypes = {
  imgSrc: PropTypes.string,
  title: PropTypes.string,
};

export default ProfileIcon;
