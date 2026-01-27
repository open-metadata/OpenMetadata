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
import { Box, MenuItem, Typography, useTheme } from '@mui/material';
import { Button } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from '../../../utils/EntityUtils';
import { getOwnerPath } from '../../../utils/ownerUtils';
import { StyledMenu } from '../../LineageTable/LineageTable.styled';
import UserPopOverCard from '../PopOverCard/UserPopOverCard';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import { OwnerRevealProps } from './OwnerReveal.interface';

export const OwnerReveal: React.FC<OwnerRevealProps> = ({
  isCompactView,
  isDropdownOpen,
  owners,
  remainingCount,
  showAllOwners,
  setIsDropdownOpen,
  setShowAllOwners,
  avatarSize = 32,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const remainingCountLabel = `+${remainingCount}`;

  const fontSize = Math.max(8, Math.floor(avatarSize * 0.4)); // Reduced to 40% of avatar size

  const handleShowMoreToggle = (event: React.MouseEvent<HTMLElement>) => {
    if (isCompactView) {
      setShowAllOwners((prev) => !prev);
    } else {
      setAnchorEl(event.currentTarget);
      setIsDropdownOpen(true);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setIsDropdownOpen(false);
  };

  if (isCompactView) {
    return (
      <Box sx={{ position: 'relative' }}>
        <Button
          className={`${
            !showAllOwners ? 'more-owners-button' : ''
          } text-sm font-medium h-auto d-flex items-center flex-center`}
          size="small"
          style={{
            width: `${avatarSize}px`,
            height: `${avatarSize}px`,
            fontSize: `${fontSize}px`,
          }}
          type="link"
          onClick={handleShowMoreToggle}>
          {showAllOwners ? t('label.less') : remainingCountLabel}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Button
        className={`${
          !showAllOwners
            ? 'more-owners-button d-flex items-center flex-center d-flex flex-center'
            : ''
        } text-sm font-medium h-auto`}
        size="small"
        style={{
          width: `${avatarSize}px`,
          height: `${avatarSize}px`,
          fontSize: `${fontSize}px`,
        }}
        type="link"
        onClick={handleShowMoreToggle}>
        {showAllOwners ? t('label.less') : remainingCountLabel}
      </Button>

      <StyledMenu
        anchorEl={anchorEl}
        id="owner-reveal-menu"
        open={isDropdownOpen}
        slotProps={{
          paper: {
            sx: {
              marginTop: '0',
            },
          },
        }}
        sx={{
          zIndex: 9999,
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        onClose={handleClose}>
        {owners.map((owner) => (
          <MenuItem
            key={owner.id}
            sx={{
              padding: '8px 16px',
              textDecoration: 'none',
            }}
            onClick={handleClose}>
            <UserPopOverCard userName={owner.name ?? ''}>
              <Link
                className="d-flex no-underline items-center gap-2 relative"
                data-testid="owner-link"
                to={getOwnerPath(owner)}>
                <ProfilePicture
                  displayName={getEntityName(owner)}
                  name={owner.name ?? ''}
                  type="circle"
                  width={avatarSize.toString()}
                />

                <Typography
                  noWrap
                  sx={{
                    width: '9rem',
                    color: theme.palette.allShades.gray[900],
                  }}
                  variant="body2">
                  {getEntityName(owner)}
                </Typography>
              </Link>
            </UserPopOverCard>
          </MenuItem>
        ))}
      </StyledMenu>
    </Box>
  );
};
