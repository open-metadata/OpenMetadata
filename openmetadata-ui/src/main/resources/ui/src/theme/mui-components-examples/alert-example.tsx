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
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import { createAlertSx } from '../icon-utils';

export function AlertExample() {
  const alertSx = createAlertSx();

  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            Alert
          </Typography>
          <Stack spacing={3}>
            <Box>
              <Typography
                sx={{ mb: 1, color: 'text.secondary' }}
                variant="body2">
                Alert Variants
              </Typography>
              <Stack spacing={2}>
                <Alert severity="success" sx={alertSx}>
                  <Typography sx={{ fontWeight: 600 }} variant="body2">
                    Your changes have been saved successfully.
                  </Typography>
                </Alert>
                <Alert severity="error" sx={alertSx}>
                  <Typography sx={{ fontWeight: 600 }} variant="body2">
                    There was an error processing your request.
                  </Typography>
                </Alert>
                <Alert severity="info" sx={createAlertSx('warning.600')}>
                  <Typography sx={{ fontWeight: 600 }} variant="body2">
                    This action cannot be undone. Please confirm.
                  </Typography>
                </Alert>
                <Alert severity="info" sx={alertSx}>
                  <Typography sx={{ fontWeight: 600 }} variant="body2">
                    New features are now available in your dashboard.
                  </Typography>
                </Alert>
              </Stack>
            </Box>

            <Box>
              <Typography
                sx={{ mb: 1, color: 'text.secondary' }}
                variant="body2">
                Alert with Actions
              </Typography>
              <Alert
                action={
                  <Stack direction="row" spacing={1}>
                    <Button color="warning" size="small">
                      Undo
                    </Button>
                    <Button size="small" variant="outlined">
                      Dismiss
                    </Button>
                  </Stack>
                }
                severity="info"
                sx={createAlertSx('warning.600')}>
                <Typography sx={{ fontWeight: 600 }} variant="body2">
                  Warning: Low storage space
                </Typography>
                <Typography variant="body2">
                  Your account is running out of storage. Upgrade your plan to
                  continue.
                </Typography>
              </Alert>
            </Box>

            <Box>
              <Typography
                sx={{ mb: 1, color: 'text.secondary' }}
                variant="body2">
                Closeable Alerts
              </Typography>
              <Stack spacing={2}>
                <Alert severity="success" sx={alertSx}>
                  <Typography sx={{ fontWeight: 600 }} variant="body2">
                    File uploaded successfully to your project.
                  </Typography>
                </Alert>
                <Alert severity="error" sx={alertSx}>
                  <Typography sx={{ fontWeight: 600 }} variant="body2">
                    Failed to connect to server. Please try again.
                  </Typography>
                </Alert>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
