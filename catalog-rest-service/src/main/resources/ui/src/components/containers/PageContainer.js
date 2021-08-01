import classnames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

const PageContainer = ({ children, leftPanelContent, className }) => {
  return (
    <div className={classnames('page-container', className || '')}>
      {leftPanelContent && <div className="side-panel">{leftPanelContent}</div>}
      {children}
    </div>
  );
};

PageContainer.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.arrayOf(PropTypes.node),
  ]).isRequired,
  leftPanelContent: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.arrayOf(PropTypes.node),
  ]),
  className: PropTypes.string,
};

export default PageContainer;
