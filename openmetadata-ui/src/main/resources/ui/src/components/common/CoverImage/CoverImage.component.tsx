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
import { Box } from '@mui/material';

interface CoverImageProps {
  imageUrl?: string;
  position?: string;
}

export const CoverImage = ({
  imageUrl,
  position = 'center',
}: CoverImageProps) => {
  return (
    <Box
      sx={{
        height: '131px',
        ...(imageUrl
          ? {
              backgroundImage: `url(${imageUrl})`,
              backgroundPosition: position,
              backgroundSize: 'cover',
              backgroundRepeat: 'no-repeat',
            }
          : {
              background:
                'linear-gradient(271.49deg, #00D2FF -11.47%, #03A0FF 59.48%, #016AFB 115.84%)',
            }),
        borderRadius: 1.5,
        margin: '-1px -1px -1px 0',
      }}
    />
  );
};
