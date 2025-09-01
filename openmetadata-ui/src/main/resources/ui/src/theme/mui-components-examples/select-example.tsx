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
import {
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';

export function SelectExample() {
  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            Select
          </Typography>
          <Box sx={{ maxWidth: 400, width: '100%' }}>
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Country</InputLabel>
                <Select defaultValue="us">
                  <MenuItem value="us">United States</MenuItem>
                  <MenuItem value="ca">Canada</MenuItem>
                  <MenuItem value="uk">United Kingdom</MenuItem>
                  <MenuItem value="de">Germany</MenuItem>
                </Select>
              </FormControl>

              <FormControl error fullWidth>
                <InputLabel>Role</InputLabel>
                <Select defaultValue="">
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="user">User</MenuItem>
                  <MenuItem value="guest">Guest</MenuItem>
                </Select>
                <Typography color="error" variant="caption">
                  Please select a role
                </Typography>
              </FormControl>

              <FormControl disabled fullWidth>
                <InputLabel>Disabled Select</InputLabel>
                <Select defaultValue="option1">
                  <MenuItem value="option1">Option 1</MenuItem>
                  <MenuItem value="option2">Option 2</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>Small Size</InputLabel>
                <Select defaultValue="sm">
                  <MenuItem value="sm">Small</MenuItem>
                  <MenuItem value="md">Medium</MenuItem>
                  <MenuItem value="lg">Large</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
