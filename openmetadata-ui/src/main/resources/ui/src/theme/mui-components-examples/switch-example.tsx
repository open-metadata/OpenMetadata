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
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';

export function SwitchExample() {
  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            Switch/Toggle
          </Typography>
          <Box sx={{ maxWidth: 400, width: '100%' }}>
            <Stack spacing={2}>
              <FormControlLabel control={<Switch />} label="Default toggle" />
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Checked toggle"
              />
              <FormControlLabel
                control={<Switch disabled />}
                label="Disabled toggle"
              />
              <FormControlLabel
                control={<Switch checked disabled />}
                label="Disabled checked"
              />
              <FormControlLabel
                control={<Switch size="small" />}
                label="Small size toggle"
              />
            </Stack>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
