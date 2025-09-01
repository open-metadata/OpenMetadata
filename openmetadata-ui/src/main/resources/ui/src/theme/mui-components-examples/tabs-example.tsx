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
  Chip,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useState } from 'react';

export function TabsExample() {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            Tabs
          </Typography>
          <Box sx={{ width: '100%' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    Documentation
                    <Chip
                      color="secondary"
                      label="12"
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                }
              />
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    Sub Domains
                    <Chip
                      color="secondary"
                      label="1"
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                }
              />
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    Assets
                    <Chip
                      color="secondary"
                      label="0"
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                }
              />
              <Tab label="Custom Properties" />
            </Tabs>

            <Box sx={{ px: 0, py: 2 }}>
              {tabValue === 0 && (
                <Typography>Documentation content with 12 items</Typography>
              )}
              {tabValue === 1 && (
                <Typography>Sub Domains content with 1 item</Typography>
              )}
              {tabValue === 2 && (
                <Typography>Assets content with 0 items</Typography>
              )}
              {tabValue === 3 && (
                <Typography>Custom Properties content</Typography>
              )}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
