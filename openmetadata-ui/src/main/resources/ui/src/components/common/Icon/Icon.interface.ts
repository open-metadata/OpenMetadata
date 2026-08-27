/*
 *  Copyright 2024 Collate.
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
import { ReactNode } from 'react';

export interface IconProps {
  iconValue: string | undefined;
  size?: number;
  className?: string;
  /** Layout/positioning styles (e.g. margin, flexShrink). Applied to the element
   * occupying space in the caller's layout, regardless of loading state. */
  wrapperStyle?: React.CSSProperties;
  /** Cosmetic styles for the rendered icon/image itself (e.g. borderRadius). Never
   * applied to the loading skeleton. */
  imageStyle?: React.CSSProperties;
  strokeWidth?: number;
  alt?: string;
  fallback?: ReactNode;
}
