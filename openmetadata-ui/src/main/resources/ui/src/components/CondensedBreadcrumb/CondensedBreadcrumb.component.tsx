/*
 *  Copyright 2025 Collate.
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
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { useTheme } from '@mui/material';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import React, { useState } from 'react';
import { CondensedBreadcrumbProps } from './CondensedBreadcrumb.interface';
import './condensedBreadcrumb.less';

export const CondensedBreadcrumb: React.FC<CondensedBreadcrumbProps> = ({
  items,
  separator = <ChevronRightIcon fontSize="small" />,
  itemsBeforeCollapse = 1,
  itemsAfterCollapse = 1,
  className,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
  };

  if (items.length === 0) {
    return null;
  }

  if (items.length <= 2) {
    return (
      <Breadcrumbs
        aria-label="breadcrumb"
        className={className}
        separator={separator}>
        {items.map((item) => (
          <Link
            color="inherit"
            href="#"
            key={item}
            sx={{ fontSize: theme.spacing(2.5) }}
            underline="hover"
            onClick={handleLinkClick}>
            {item}
          </Link>
        ))}
      </Breadcrumbs>
    );
  }

  const hiddenItems = items.slice(itemsBeforeCollapse, -itemsAfterCollapse);

  return (
    <React.Fragment>
      <Menu
        anchorEl={anchorEl}
        aria-labelledby="condensed-breadcrumb-menu"
        open={open}
        onClose={handleClose}>
        {hiddenItems.map((item) => (
          <MenuItem
            className="breadcrumb-menu-item"
            key={item}
            onClick={handleClose}>
            {item}
          </MenuItem>
        ))}
      </Menu>
      <Breadcrumbs
        aria-label="breadcrumb"
        className={className}
        separator={separator}>
        {items.slice(0, itemsBeforeCollapse).map((item) => (
          <Link
            color="inherit"
            href="#"
            key={item}
            sx={{ fontSize: theme.spacing(2.5) }}
            underline="hover"
            onClick={handleLinkClick}>
            {item}
          </Link>
        ))}
        {hiddenItems.length > 0 && (
          <IconButton
            className="breadcrumb-menu-button"
            size="small"
            onClick={handleClick}>
            <MoreHorizIcon fontSize="small" />
          </IconButton>
        )}
        {items.slice(-itemsAfterCollapse).map((item) => (
          <Link
            color="inherit"
            href="#"
            key={`end-${item}`}
            sx={{ fontSize: theme.spacing(2.5) }}
            underline="hover"
            onClick={handleLinkClick}>
            {item}
          </Link>
        ))}
      </Breadcrumbs>
    </React.Fragment>
  );
};
