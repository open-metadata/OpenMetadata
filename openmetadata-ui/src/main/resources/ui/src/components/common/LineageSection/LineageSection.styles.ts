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
import { SxProps, Theme } from '@mui/material';

export const getTextStyles = (theme: Theme): SxProps<Theme> => ({
  fontSize: '13px',
  fontWeight: theme.typography.caption.fontWeight,
  color: theme.palette.allShades?.info?.[700],
});

export const getSectionStyles = (): SxProps<Theme> => ({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
});

export const getIconWrapperStyles = (theme: Theme): SxProps<Theme> => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.allShades?.gray?.[600],
});
