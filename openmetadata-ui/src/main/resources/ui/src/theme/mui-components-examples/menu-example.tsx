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
/* eslint-disable i18next/no-literal-string */
import { MoreVert as MoreVertIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import { useState } from 'react';

export function MenuExample() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            Menu/Dropdown
          </Typography>
          <Box>
            <Button
              endIcon={<MoreVertIcon />}
              variant="outlined"
              onClick={handleClick}>
              Open Menu
            </Button>
            <Menu
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              open={open}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              onClose={handleClose}>
              <MenuItem onClick={handleClose}>Profile</MenuItem>
              <MenuItem onClick={handleClose}>Settings</MenuItem>
              <MenuItem onClick={handleClose}>Logout</MenuItem>
              <MenuItem disabled onClick={handleClose}>
                Disabled Item
              </MenuItem>
            </Menu>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
