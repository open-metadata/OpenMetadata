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

import { Box, Button, MenuItem, Typography, useTheme } from '@mui/material';
import React, { ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as IconTeamsGrey } from '../../../assets/svg/teams-grey.svg';
import { EntityReference } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityUtils';
import { getOwnerPath } from '../../../utils/ownerUtils';
import { StyledMenu } from '../../LineageTable/LineageTable.styled';

export interface OwnerTeamListProps {
  owners: EntityReference[];
  avatarSize: number;
  ownerDisplayName?: Map<string, ReactNode>;
  placement?: 'vertical' | 'horizontal';
}

export const OwnerTeamList: React.FC<OwnerTeamListProps> = ({
  owners,
  avatarSize,
  ownerDisplayName,
  placement,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const { visibleTeam, remainingTeam } = useMemo(() => {
    return {
      visibleTeam: owners[0],
      remainingTeam: owners.slice(1),
    };
  }, [owners]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
      }}>
      <Link
        className="no-underline"
        data-testid="owner-link"
        to={getOwnerPath(visibleTeam)}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '100%',
          }}>
          <IconTeamsGrey
            data-testid={getEntityName(visibleTeam)}
            style={{
              width: avatarSize,
              height: avatarSize,
              color: theme.palette.allShades.gray[700],
            }}
          />
          <Typography
            noWrap
            sx={{
              color: theme.palette.allShades.gray[900],
              maxWidth:
                placement === 'vertical' || owners.length < 2
                  ? '120px'
                  : '50px',
              fontSize: '12px',
              fontWeight: 500,
              lineHeight: 'initial',
            }}>
            {ownerDisplayName?.get(visibleTeam.name ?? '') ??
              getEntityName(visibleTeam)}
          </Typography>
        </Box>
      </Link>

      {owners.length > 1 && (
        <>
          <Button
            size="small"
            sx={{
              marginLeft: '8px',
              fontWeight: 400,
              fontSize: '12px',
              padding: 0,
              minWidth: 'fit-content',
              color: theme.palette.allShades.brand[700],
            }}
            variant="text"
            onClick={handleClick}>
            {`+${owners.length - 1}`}
          </Button>

          <StyledMenu
            anchorEl={anchorEl}
            id="owner-user-options-menu"
            open={open}
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
            {remainingTeam.map((owner) => (
              <MenuItem
                key={owner.id}
                sx={{
                  padding: '8px 16px',
                  textDecoration: 'none',
                }}
                onClick={handleClose}>
                <Link data-testid="owner-link" to={getOwnerPath(owner)}>
                  <Typography
                    noWrap
                    sx={{
                      width: '12rem',
                      color: theme.palette.allShades.gray[900],
                    }}
                    variant="body2">
                    {ownerDisplayName?.get(owner.name ?? '') ??
                      getEntityName(owner)}
                  </Typography>
                </Link>
              </MenuItem>
            ))}
          </StyledMenu>
        </>
      )}
    </Box>
  );
};
