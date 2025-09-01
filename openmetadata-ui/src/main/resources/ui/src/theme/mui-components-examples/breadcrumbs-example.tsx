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
  Breadcrumbs,
  Card,
  CardContent,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { ChevronRight, Home02 } from '@untitledui/icons';

export function BreadcrumbsExample() {
  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            Breadcrumbs
          </Typography>
          <Stack spacing={3}>
            <Box>
              <Typography
                sx={{ mb: 1, color: 'text.secondary' }}
                variant="body2">
                With Home Icon
              </Typography>
              <Breadcrumbs separator={<ChevronRight className="h-3 w-3" />}>
                <Link href="/" sx={{ display: 'flex', alignItems: 'center' }}>
                  <Home02
                    className="h-5 w-5"
                    strokeWidth="1px"
                    style={{ marginRight: '4px', color: '#535862' }}
                  />
                </Link>
                <Link href="/settings">Settings</Link>
                <Link href="/settings/profile">Profile</Link>
                <Typography
                  sx={{
                    color: '#175CD3',
                    fontSize: '14px',
                    lineHeight: '20px',
                  }}>
                  Edit Profile
                </Typography>
              </Breadcrumbs>
            </Box>

            <Box>
              <Typography
                sx={{ mb: 1, color: 'text.secondary' }}
                variant="body2">
                With maxItems (Collapsed)
              </Typography>
              <Breadcrumbs
                maxItems={4}
                separator={<ChevronRight className="h-3 w-3" />}>
                <Link href="/" sx={{ display: 'flex', alignItems: 'center' }}>
                  <Home02
                    className="h-5 w-5"
                    strokeWidth="1px"
                    style={{ marginRight: '4px', color: '#535862' }}
                  />
                </Link>
                <Link href="/projects">Projects</Link>
                <Link href="/projects/website">Website Redesign</Link>
                <Link href="/projects/website/design">Design System</Link>
                <Link href="/projects/website/design/components">
                  Components
                </Link>
                <Typography
                  sx={{
                    color: '#175CD3',
                    fontSize: '14px',
                    lineHeight: '20px',
                  }}>
                  Form Elements
                </Typography>
              </Breadcrumbs>
            </Box>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
