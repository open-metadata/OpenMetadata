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

export const BrandUrl: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M18 7.28c0-2.383 0-3.574-.74-4.313-.74-.74-1.93-.74-4.313-.74H7.053c-2.382 0-3.573 0-4.313.74S2 4.897 2 7.279v4.21c0 2.382 0 3.573.74 4.313s1.93.74 4.313.74M2 5.594h16m-5.02 8.812q.105.173.25.324a1.767 1.767 0 0 0 2.574 0l1.608-1.673a1.95 1.95 0 0 0 0-2.678 1.77 1.77 0 0 0-2.573 0l-.354.369"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m13.46 16.846-.354.369a1.77 1.77 0 0 1-2.573 0 1.95 1.95 0 0 1 0-2.678l1.608-1.674a1.77 1.77 0 0 1 2.573 0q.145.151.25.325"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
BrandUrl.displayName = 'BrandUrl';
