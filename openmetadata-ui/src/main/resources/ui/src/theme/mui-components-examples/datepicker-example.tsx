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
  Stack,
  Typography,
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { Calendar } from '@untitledui/icons';
import dayjs from 'dayjs';
import { useRef, useState } from 'react';

export function DatePickerExample() {
  const [dateValue, setDateValue] = useState<dayjs.Dayjs | null>(
    dayjs('2024-01-15')
  );
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const dateButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Card>
      <CardContent>
        <Box>
          <Typography gutterBottom variant="h6">
            DatePicker
          </Typography>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Stack spacing={2} sx={{ maxWidth: 400 }}>
              <Box>
                <Typography
                  sx={{ mb: 1, color: 'text.secondary' }}
                  variant="body2">
                  DatePicker with Button Trigger
                </Typography>
                <Button
                  color="secondary"
                  ref={dateButtonRef}
                  startIcon={<Calendar className="h-5 w-5" />}
                  sx={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    width: '200px',
                  }}
                  variant="contained"
                  onClick={() => setDatePickerOpen(true)}>
                  {dateValue ? dateValue.format('DD MMM YYYY') : 'Select date'}
                </Button>

                {/* Hidden DatePicker for functionality */}
                <DatePicker
                  open={datePickerOpen}
                  slotProps={{
                    popper: {
                      placement: 'bottom-start',
                      anchorEl: dateButtonRef.current, // Use ref to button element
                    },
                    textField: {
                      sx: { display: 'none' }, // Hide the default input field
                    },
                  }}
                  value={dateValue}
                  onChange={(newValue) => setDateValue(newValue)}
                  onClose={() => setDatePickerOpen(false)}
                />
              </Box>

              <Box>
                <Typography
                  sx={{ mb: 1, color: 'text.secondary' }}
                  variant="body2">
                  Small Size DatePicker
                </Typography>
                <Button
                  color="secondary"
                  size="small"
                  startIcon={<Calendar className="h-4 w-4" />}
                  sx={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    width: '180px',
                  }}
                  variant="contained">
                  12 Aug 2025
                </Button>
              </Box>
            </Stack>
          </LocalizationProvider>
        </Box>
      </CardContent>
    </Card>
  );
}
