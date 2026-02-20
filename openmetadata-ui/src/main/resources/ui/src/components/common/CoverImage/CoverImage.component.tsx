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
import { Box, useTheme } from '@mui/material';
import imageClassBase from '../../BlockEditor/Extensions/image/ImageClassBase';

interface CoverImageProps {
  imageUrl?: string;
  position?: { x?: string; y?: string }; // CSS percentage values like "-16%"
}

export const CoverImage = ({ imageUrl, position }: CoverImageProps) => {
  const theme = useTheme();
  // Get authenticated image hook from ImageClassBase (paid version override)
  const authenticatedImageUrl = imageClassBase.getAuthenticatedImageUrl();

  // Always call unconditionally to avoid React Hook Rules violation
  const authenticatedResult = authenticatedImageUrl?.(imageUrl ?? '');
  const imageSrc = authenticatedResult?.imageSrc ?? imageUrl ?? '';
  const isLoading = authenticatedResult?.isLoading ?? false;

  // Check if image is ready to display (prevent 401 errors on authenticated URLs)
  const showImage =
    imageSrc &&
    (!imageUrl?.includes('/api/v1/attachments/') ||
      imageSrc.startsWith('blob:'));

  return (
    <Box
      data-testid="cover-image-container"
      sx={{
        height: '131px',
        borderRadius: 1.5,
        margin: '-1px -1px -1px 0',
        overflow: 'hidden',
        position: 'relative',
      }}>
      {showImage ? (
        <Box
          alt="Cover"
          component="img"
          data-testid="cover-image"
          src={imageSrc}
          sx={{
            width: '100%',
            height: 'auto',
            minHeight: 131,
            objectFit: 'cover',
            objectPosition: 'center top',
            transform: position?.y ? `translateY(${position.y})` : 'none',
            display: 'block',
          }}
        />
      ) : (
        <Box
          data-testid={
            isLoading ? 'cover-image-loading' : 'cover-image-placeholder'
          }
          sx={{
            width: '100%',
            height: '100%',
            background: isLoading
              ? theme.palette.grey[100]
              : 'linear-gradient(271.49deg, #00D2FF -11.47%, #03A0FF 59.48%, #016AFB 115.84%)',
          }}
        />
      )}
    </Box>
  );
};
