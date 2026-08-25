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
import imageClassBase from '../../BlockEditor/Extensions/image/ImageClassBase';

interface CoverImageProps {
  imageUrl?: string;
  position?: { x?: string; y?: string }; // CSS percentage values like "-16%"
}

export const CoverImage = ({ imageUrl, position }: CoverImageProps) => {
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
    <div
      className="tw:h-[131px] tw:rounded-xl tw:-mt-px tw:-mr-px tw:-mb-px tw:ml-0 tw:overflow-hidden tw:relative"
      data-testid="cover-image-container">
      {showImage ? (
        <img
          alt="Cover"
          className="tw:w-full tw:h-auto tw:min-h-[131px] tw:object-cover tw:object-[center_top] tw:block"
          data-testid="cover-image"
          src={imageSrc}
          style={
            position?.y ? { transform: `translateY(${position.y})` } : undefined
          }
        />
      ) : (
        <div
          className={
            isLoading
              ? 'tw:w-full tw:h-full tw:bg-tertiary'
              : 'tw:w-full tw:h-full tw:bg-[linear-gradient(271.49deg,#00D2FF_-11.47%,#03A0FF_59.48%,#016AFB_115.84%)]'
          }
          data-testid={
            isLoading ? 'cover-image-loading' : 'cover-image-placeholder'
          }
        />
      )}
    </div>
  );
};
