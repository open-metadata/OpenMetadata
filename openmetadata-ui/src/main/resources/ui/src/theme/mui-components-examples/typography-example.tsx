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
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';

export function TypographyExample() {
  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            Typography
          </Typography>
          <Stack spacing={3}>
            <Box>
              <Typography
                sx={{ mb: 2, color: 'text.secondary' }}
                variant="body2">
                Display Sizes (Headings)
              </Typography>
              <Stack spacing={2}>
                <Typography variant="h1">
                  Display XL - The quick brown fox
                </Typography>
                <Typography variant="h2">
                  Display LG - The quick brown fox
                </Typography>
                <Typography variant="h3">
                  Display MD - The quick brown fox
                </Typography>
                <Typography variant="h4">
                  Display SM - The quick brown fox
                </Typography>
                <Typography variant="h5">
                  Display XS - The quick brown fox
                </Typography>
                <Typography variant="h6">
                  Text XL - The quick brown fox
                </Typography>
              </Stack>
            </Box>

            <Box>
              <Typography
                sx={{ mb: 2, color: 'text.secondary' }}
                variant="body2">
                Body Text Variants
              </Typography>
              <Stack spacing={2}>
                <Typography variant="subtitle1">
                  Subtitle 1 (LG) - The quick brown fox jumps over the lazy dog
                </Typography>
                <Typography variant="subtitle2">
                  Subtitle 2 (MD) - The quick brown fox jumps over the lazy dog
                </Typography>
                <Typography variant="body1">
                  Body 1 (MD) - The quick brown fox jumps over the lazy dog.
                  This is the primary body text used for most content.
                </Typography>
                <Typography variant="body2">
                  Body 2 (SM) - The quick brown fox jumps over the lazy dog.
                  This is secondary body text for supporting content.
                </Typography>
                <Typography variant="caption">
                  Caption (XS) - The quick brown fox jumps over the lazy dog
                </Typography>
                <Typography variant="overline">
                  Overline (XS) - The quick brown fox
                </Typography>
              </Stack>
            </Box>

            <Box>
              <Typography
                sx={{ mb: 2, color: 'text.secondary' }}
                variant="body2">
                Text Colors
              </Typography>
              <Stack spacing={1}>
                <Typography sx={{ color: 'var(--color-text-primary)' }}>
                  Primary Text Color
                </Typography>
                <Typography sx={{ color: 'var(--color-text-secondary)' }}>
                  Secondary Text Color
                </Typography>
                <Typography sx={{ color: 'var(--color-text-tertiary)' }}>
                  Tertiary Text Color
                </Typography>
                <Typography sx={{ color: 'var(--color-text-quaternary)' }}>
                  Quaternary Text Color
                </Typography>
                <Typography sx={{ color: 'var(--color-text-disabled)' }}>
                  Disabled Text Color
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
