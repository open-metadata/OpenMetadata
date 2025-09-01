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
import { Search as SearchIcon } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

export function TextFieldExample() {
  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            Text Field
          </Typography>
          <Box sx={{ maxWidth: 400, width: '100%' }}>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Email address"
                placeholder="Enter your email"
              />
              <TextField
                fullWidth
                helperText="This is helper text"
                label="Password"
                placeholder="Enter password"
              />
              <TextField
                error
                fullWidth
                helperText="This field has an error"
                label="Username"
                placeholder="Enter username"
              />
              <TextField
                disabled
                fullWidth
                helperText="This field is disabled"
                label="Phone number"
                placeholder="Disabled input"
              />
              <TextField
                fullWidth
                label="Company name"
                placeholder="Small input"
                size="small"
              />
              <TextField
                fullWidth
                placeholder="Search users..."
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Stack>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
