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
import { Favorite as FavoriteIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';

export function TooltipExample() {
  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            Tooltip
          </Typography>
          <Stack useFlexGap direction="row" flexWrap="wrap" spacing={2}>
            <Tooltip placement="top" title="This is a tooltip">
              <Button variant="outlined">Hover me</Button>
            </Tooltip>

            <Tooltip title="This is a longer tooltip message that demonstrates text wrapping">
              <IconButton color="primary">
                <FavoriteIcon />
              </IconButton>
            </Tooltip>

            <Tooltip placement="bottom" title="Bottom tooltip">
              <Button color="primary" variant="contained">
                Bottom
              </Button>
            </Tooltip>

            <Tooltip placement="left" title="Left tooltip">
              <Button color="secondary" variant="contained">
                Left
              </Button>
            </Tooltip>

            <Tooltip placement="right" title="Right tooltip">
              <Button variant="text">Right</Button>
            </Tooltip>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
