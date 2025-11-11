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

/**
 * Position offset for cover image using CSS percentage values
 * @property x - Horizontal offset percentage (currently unused, reserved for future)
 * @property y - Vertical offset percentage using CSS translateY()
 *               - "0%" = top edge of image aligned with container top
 *               - negative values = image moves up (shows bottom portion)
 *               - positive values = image moves down (shows top portion)
 *               - Example: "-16%" moves image up by 16% of its height
 */
export interface CoverImagePosition {
  x?: string; // CSS percentage value like "0%" (currently unused)
  y?: string; // CSS percentage value like "-16%"
}

/**
 * Cover image value with URL (already uploaded)
 * @property url - The image URL from backend
 * @property position - Optional positioning offset
 */
export interface CoverImageUrlValue {
  url: string;
  position?: CoverImagePosition;
}

/**
 * Cover image value with File (not uploaded yet)
 * @property file - The File object to be uploaded later
 * @property position - Optional positioning offset
 */
export interface CoverImageFileValue {
  file: File;
  position?: CoverImagePosition;
}

/**
 * Union type for cover image value - can be either File or URL
 */
export type CoverImageValue = CoverImageUrlValue | CoverImageFileValue;

export interface MUICoverImageUploadProps {
  value?: CoverImageValue;
  onChange?: (value: CoverImageValue | undefined) => void;
  onUpload?: (file: File) => Promise<string>; // Optional - if not provided, stores file locally
  label?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  maxSizeMB?: number;
  acceptedFormats?: string[];
  maxDimensions?: {
    width: number;
    height: number;
  };
}
