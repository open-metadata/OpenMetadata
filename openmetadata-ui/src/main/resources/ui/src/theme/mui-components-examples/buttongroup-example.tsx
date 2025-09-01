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
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';

export function ButtonGroupExample() {
  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            Button Group
          </Typography>
          <Stack spacing={3}>
            <Box>
              <Typography
                sx={{ mb: 1, color: 'text.secondary' }}
                variant="body2">
                Default Button Group
              </Typography>
              <ButtonGroup variant="outlined">
                <Button>Left</Button>
                <Button>Middle</Button>
                <Button>Right</Button>
              </ButtonGroup>
            </Box>

            <Box>
              <Typography
                sx={{ mb: 1, color: 'text.secondary' }}
                variant="body2">
                With Selection
              </Typography>
              <ButtonGroup variant="outlined">
                <Button variant="contained">Active</Button>
                <Button>Inactive</Button>
                <Button>Option</Button>
              </ButtonGroup>
            </Box>

            <Box>
              <Typography
                sx={{ mb: 1, color: 'text.secondary' }}
                variant="body2">
                Different Sizes
              </Typography>
              <Stack spacing={1}>
                <ButtonGroup size="small" variant="outlined">
                  <Button>Small</Button>
                  <Button>Group</Button>
                </ButtonGroup>
                <ButtonGroup size="medium" variant="outlined">
                  <Button>Medium</Button>
                  <Button>Group</Button>
                </ButtonGroup>
                <ButtonGroup size="large" variant="outlined">
                  <Button>Large</Button>
                  <Button>Group</Button>
                </ButtonGroup>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
