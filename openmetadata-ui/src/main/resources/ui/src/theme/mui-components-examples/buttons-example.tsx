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
  Card,
  CardContent,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  Edit03 as EditIcon,
  Heart as FavoriteIcon,
  Plus as AddIcon,
  Share01 as ShareIcon,
  Trash01 as DeleteIcon,
} from '@untitledui/icons';

export function ButtonsExample() {
  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            Button Variants
          </Typography>
          <Stack useFlexGap direction="row" flexWrap="wrap" spacing={2}>
            <Box>
              <Button
                color="primary"
                startIcon={<FavoriteIcon />}
                variant="contained">
                Primary
              </Button>
            </Box>
            <Box>
              <Button
                color="secondary"
                endIcon={<ShareIcon />}
                variant="contained">
                Secondary
              </Button>
            </Box>
            <Box>
              <Button color="primary" variant="outlined">
                Outlined
              </Button>
            </Box>
            <Box>
              <Button color="primary" variant="text">
                Text Button
              </Button>
            </Box>
            <Box>
              <Button
                color="error"
                startIcon={<DeleteIcon />}
                variant="contained">
                Destructive
              </Button>
            </Box>
          </Stack>
        </Box>

        <Box>
          <Typography gutterBottom variant="h6">
            Button Sizes
          </Typography>
          <Stack alignItems="center" direction="row" spacing={2}>
            <Button size="small" variant="contained">
              Small
            </Button>
            <Button size="medium" variant="contained">
              Medium
            </Button>
            <Button size="large" variant="contained">
              Large
            </Button>
          </Stack>
        </Box>

        <Box>
          <Typography gutterBottom variant="h6">
            Button States
          </Typography>
          <Stack direction="row" spacing={2}>
            <Box>
              <Button variant="contained">Normal</Button>
            </Box>
            <Box>
              <Button disabled variant="contained">
                Disabled
              </Button>
            </Box>
          </Stack>
        </Box>

        <Box>
          <Typography gutterBottom variant="h6">
            Icon Buttons
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography
                sx={{ mb: 1, color: 'text.secondary' }}
                variant="body2">
                Secondary Style (Default - with shadow and ring)
              </Typography>
              <Stack alignItems="center" direction="row" spacing={1}>
                <IconButton size="small">
                  <EditIcon />
                </IconButton>
                <IconButton size="medium">
                  <ShareIcon />
                </IconButton>
                <IconButton size="large">
                  <AddIcon />
                </IconButton>
                <IconButton disabled>
                  <DeleteIcon />
                </IconButton>
              </Stack>
            </Box>
            <Box>
              <Typography
                sx={{ mb: 1, color: 'text.secondary' }}
                variant="body2">
                Tertiary Style (Primary color - no background)
              </Typography>
              <Stack alignItems="center" direction="row" spacing={1}>
                <IconButton color="primary" size="small">
                  <EditIcon />
                </IconButton>
                <IconButton color="primary" size="medium">
                  <ShareIcon />
                </IconButton>
                <IconButton color="primary" size="large">
                  <AddIcon />
                </IconButton>
                <IconButton disabled color="primary">
                  <DeleteIcon />
                </IconButton>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
