import PropTypes from 'prop-types';
import React from 'react';
import { Nav } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

const Sidebar = ({ isCollapsed, navItems }) => {
  const location = useLocation();

  return (
    <div
      className={`${isCollapsed ? 'collapsed' : 'expanded'}-sidebar sidebar`}
      data-testid="sidebar">
      <div className="sidebar-header">
        <Link to="/">
          <SVGIcons
            alt="OpenMetadata Logo"
            icon={isCollapsed ? Icons.LOGO_SMALL : Icons.LOGO}
          />
        </Link>
      </div>
      <Nav as="ul" className="flex-column" id="sidebar">
        {navItems.map((item) => (
          <Nav.Item as="li" data-testid="sidebar-item" key={item.name}>
            <Link
              className={
                'sidebar-item' +
                (location.pathname.startsWith(item.to) ? ' active' : '')
              }
              to={item.to}>
              <div className="svg-icon">
                <SVGIcons alt={item.name} icon={item.icon} title={item.name} />
              </div>
              {!isCollapsed && <span className="label">{item.name}</span>}
            </Link>
          </Nav.Item>
        ))}
      </Nav>
    </div>
  );
};

Sidebar.defaultProps = {
  isCollapsed: false,
  navItems: [
    { name: 'My Data', to: '/my-data', icon: Icons.MY_DATA },
    { name: 'Reports', to: '/reports', icon: Icons.REPORTS },
    { name: 'Explore', to: '/explore', icon: Icons.EXPLORE },
    { name: 'Workflows', to: '/workflows', icon: Icons.WORKFLOWS },
    { name: 'SQL Builder', to: '/sql-builder', icon: Icons.SQL_BUILDER },
    { name: 'Teams', to: '/teams', icon: Icons.TEAMS },
    { name: 'Settings', to: '/settings', icon: Icons.SETTINGS },
  ],
};

Sidebar.propTypes = {
  isCollapsed: PropTypes.bool,
  navItems: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      to: PropTypes.string,
      icon: PropTypes.string,
    })
  ),
};

export default Sidebar;
