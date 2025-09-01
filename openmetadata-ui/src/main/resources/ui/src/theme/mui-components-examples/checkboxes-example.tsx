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
import { ThemedCheckbox as Checkbox } from '@/theme/themed-checkbox';
import {
  Box,
  Card,
  CardContent,
  FormControlLabel,
  FormGroup,
  Stack,
  Typography,
} from '@mui/material';

export function CheckboxesExample() {
  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            Checkboxes
          </Typography>
          <FormGroup>
            <Stack spacing={2}>
              <Box>
                <Typography
                  sx={{ mb: 1, color: 'text.secondary' }}
                  variant="body2">
                  Small Size (Default)
                </Typography>
                <Stack direction="row" spacing={2}>
                  <FormControlLabel
                    control={<Checkbox size="small" />}
                    label="Unchecked"
                  />
                  <FormControlLabel
                    control={<Checkbox defaultChecked size="small" />}
                    label="Checked"
                  />
                  <FormControlLabel
                    control={<Checkbox indeterminate size="small" />}
                    label="Indeterminate"
                  />
                  <FormControlLabel
                    control={<Checkbox disabled size="small" />}
                    label="Disabled"
                  />
                  <FormControlLabel
                    control={<Checkbox checked disabled size="small" />}
                    label="Disabled Checked"
                  />
                </Stack>
              </Box>
              <Box>
                <Typography
                  sx={{ mb: 1, color: 'text.secondary' }}
                  variant="body2">
                  Medium Size
                </Typography>
                <Stack direction="row" spacing={2}>
                  <FormControlLabel
                    control={<Checkbox size="medium" />}
                    label="Unchecked"
                  />
                  <FormControlLabel
                    control={<Checkbox defaultChecked size="medium" />}
                    label="Checked"
                  />
                  <FormControlLabel
                    control={<Checkbox indeterminate size="medium" />}
                    label="Indeterminate"
                  />
                  <FormControlLabel
                    control={<Checkbox disabled size="medium" />}
                    label="Disabled"
                  />
                  <FormControlLabel
                    control={<Checkbox checked disabled size="medium" />}
                    label="Disabled Checked"
                  />
                </Stack>
              </Box>
            </Stack>
          </FormGroup>
        </Box>
      </CardContent>
    </Card>
  );
}
