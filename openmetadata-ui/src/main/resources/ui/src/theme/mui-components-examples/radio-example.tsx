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
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';

export function RadioExample() {
  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            Radio Buttons
          </Typography>
          <Box sx={{ maxWidth: 400, width: '100%' }}>
            <Stack spacing={3}>
              <Box>
                <Typography
                  sx={{ mb: 1, color: 'text.secondary' }}
                  variant="body2">
                  Small Size (Default)
                </Typography>
                <FormControl>
                  <RadioGroup defaultValue="option1">
                    <FormControlLabel
                      control={<Radio size="small" />}
                      label="Option 1"
                      value="option1"
                    />
                    <FormControlLabel
                      control={<Radio size="small" />}
                      label="Option 2"
                      value="option2"
                    />
                    <FormControlLabel
                      control={<Radio disabled size="small" />}
                      label="Disabled"
                      value="option3"
                    />
                  </RadioGroup>
                </FormControl>
              </Box>

              <Box>
                <Typography
                  sx={{ mb: 1, color: 'text.secondary' }}
                  variant="body2">
                  Medium Size
                </Typography>
                <FormControl>
                  <RadioGroup defaultValue="large">
                    <FormControlLabel
                      control={<Radio />}
                      label="Large"
                      value="large"
                    />
                    <FormControlLabel
                      control={<Radio />}
                      label="Medium"
                      value="medium"
                    />
                    <FormControlLabel
                      control={<Radio disabled />}
                      label="Disabled"
                      value="small"
                    />
                  </RadioGroup>
                </FormControl>
              </Box>
            </Stack>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
