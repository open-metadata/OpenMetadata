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
  Stack,
  TextField,
  Typography,
} from '@mui/material';

export function TextareaExample() {
  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            Textarea
          </Typography>
          <Box sx={{ maxWidth: 400, width: '100%' }}>
            <Stack spacing={2}>
              <TextField
                fullWidth
                multiline
                label="Description"
                placeholder="Enter description..."
                rows={3}
              />
              <TextField
                fullWidth
                multiline
                helperText="Maximum 500 characters"
                label="Comments"
                placeholder="Add your comments"
                rows={4}
              />
              <TextField
                error
                fullWidth
                multiline
                helperText="This field has an error"
                label="Feedback"
                placeholder="Your feedback"
                rows={3}
              />
              <TextField
                disabled
                fullWidth
                multiline
                helperText="This field is disabled"
                label="Notes"
                placeholder="Disabled textarea"
                rows={2}
              />
            </Stack>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
