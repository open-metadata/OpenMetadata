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
 * Cover image value with optional positioning
 * @property url - The image URL
 * @property position - Optional positioning offset
 * @property position.y - Vertical offset in pixels using CSS translateY()
 *                        - 0 = top edge of image aligned with container top
 *                        - negative values = image moves up (shows bottom portion)
 *                        - positive values = image moves down (shows top portion)
 *                        - center = (minY + maxY) / 2 where minY = -(imageHeight - containerHeight)
 */
export interface CoverImageValue {
  url: string;
  position?: {
    x?: number;
    y?: number;
  };
}

export interface MUICoverImageUploadProps {
  value?: CoverImageValue;
  onChange?: (value: CoverImageValue) => void;
  onUpload: (file: File) => Promise<string>;
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
