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
import * as React from 'react';
import type { SVGProps, FC } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const HealthyDataAssets: FC<Props> = ({
  size = 24,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M2.398 6.218c.8-3.033 4.344-5.173 7.719-1.03 3.809-4.673 7.83-1.354 7.882 2.226 0 5.328-6.375 9.702-7.882 9.702-.902 0-3.544-1.564-5.523-3.961"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.273 9.372H11.38l-1.892 2.523L6.967 7.48l-1.892 2.523H2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
HealthyDataAssets.displayName = 'HealthyDataAssets';
