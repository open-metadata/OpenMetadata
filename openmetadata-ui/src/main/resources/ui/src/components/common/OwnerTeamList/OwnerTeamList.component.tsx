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

import { Box, Button, Typography, useTheme } from '@mui/material';
import { Dropdown } from 'antd';
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as IconTeamsGrey } from '../../../assets/svg/teams-grey.svg';
import { EntityReference } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityUtils';
import { getOwnerPath } from '../../../utils/ownerUtils';

export interface OwnerTeamListProps {
  owners: EntityReference[];
  avatarSize: number;
}

export const OwnerTeamList: React.FC<OwnerTeamListProps> = ({
  owners,
  avatarSize,
}) => {
  const theme = useTheme();

  // Calculate font size based on avatar size
  const fontSize = Math.max(8, Math.floor(avatarSize * 0.6)); // Reduced to 40% of avatar size

  const { visibleTeam, remainingTeam } = useMemo(() => {
    return {
      visibleTeam: owners.slice(0, 1)[0],
      remainingTeam: owners.slice(1),
    };
  }, [owners]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        width: '100%',
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
              maxWidth: owners.length > 1 ? '50px' : '120px',
              fontSize: `${fontSize}px`,
              lineHeight: 'initial',
            }}
            // variant="body2"
          >
            {getEntityName(visibleTeam)}
          </Typography>
        </Box>
      </Link>

      {owners.length > 1 && (
        <Dropdown
          menu={{
            items: remainingTeam.map((owner) => ({
              key: owner.id,
              label: (
                <Link
                  className="d-flex no-underline items-center gap-2 relative"
                  data-testid="owner-link"
                  to={getOwnerPath(owner)}>
                  <Typography noWrap sx={{ width: '9rem' }} variant="body2">
                    {getEntityName(owner)}
                  </Typography>
                </Link>
              ),
            })),
            className: 'owner-dropdown-container',
          }}>
          <Button
            size="small"
            sx={{
              marginLeft: '8px',
              fontWeight: 400,
              fontSize: `${fontSize}px`,
              padding: 0,
              minWidth: 'fit-content',
              color: theme.palette.allShades.brand[700],
            }}
            variant="text">
            {`+${owners.length - 1}`}
          </Button>
        </Dropdown>
      )}
    </Box>
  );
};
