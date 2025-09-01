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
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';

export function ChipsExample() {
  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            Chips / Badges
          </Typography>
          <Stack spacing={3}>
            <Box>
              <Typography
                sx={{ mb: 1, color: 'text.secondary' }}
                variant="body2">
                Pill Badges (Rounded - variant="filled")
              </Typography>
              <Stack useFlexGap direction="row" flexWrap="wrap" spacing={1}>
                <Chip
                  color="primary"
                  label="Brand"
                  size="small"
                  variant="filled"
                />
                <Chip
                  color="secondary"
                  label="Gray"
                  size="small"
                  variant="filled"
                />
                <Chip
                  color="success"
                  label="Success"
                  size="medium"
                  variant="filled"
                />
                <Chip
                  color="warning"
                  label="Warning"
                  size="medium"
                  variant="filled"
                />
                <Chip
                  color="error"
                  label="Error"
                  size="medium"
                  variant="filled"
                />
                <Chip
                  color="primary"
                  label="Deletable"
                  variant="filled"
                  onDelete={() => {}} // eslint-disable-line @typescript-eslint/no-empty-function
                />
              </Stack>
            </Box>

            <Box>
              <Typography
                sx={{ mb: 1, color: 'text.secondary' }}
                variant="body2">
                Rectangle Badges (variant="outlined")
              </Typography>
              <Stack useFlexGap direction="row" flexWrap="wrap" spacing={1}>
                <Chip
                  color="primary"
                  label="Brand"
                  size="small"
                  variant="outlined"
                />
                <Chip
                  color="secondary"
                  label="Gray"
                  size="small"
                  variant="outlined"
                />
                <Chip
                  color="success"
                  label="Success"
                  size="medium"
                  variant="outlined"
                />
                <Chip
                  color="warning"
                  label="Warning"
                  size="medium"
                  variant="outlined"
                />
                <Chip
                  color="error"
                  label="Error"
                  size="medium"
                  variant="outlined"
                />
                <Chip
                  color="primary"
                  label="Clickable"
                  variant="outlined"
                  onClick={() => {}} // eslint-disable-line @typescript-eslint/no-empty-function
                />
              </Stack>
            </Box>

            <Box>
              <Typography
                sx={{ mb: 1, color: 'text.secondary' }}
                variant="body2">
                BlueGray Tags (variant="blueGray" size="large")
              </Typography>
              <Stack useFlexGap direction="row" flexWrap="wrap" spacing={1}>
                <Chip label="Required" size="large" variant="blueGray" />
                <Chip label="URL" size="large" variant="blueGray" />
                <Chip label="Optional" size="large" variant="blueGray" />
                <Chip label="Deprecated" size="large" variant="blueGray" />
                <Chip
                  label="Tag with long text"
                  size="large"
                  variant="blueGray"
                />
              </Stack>
            </Box>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
