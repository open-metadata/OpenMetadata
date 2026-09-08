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

export const Upload: FC<Props> = ({
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
      d="M9.66 13.325H5.387c-2.058-.003-3.726-1.609-3.726-3.59S3.328 6.15 5.386 6.15c.314-1.41 1.435-2.56 2.94-3.02 1.504-.457 3.165-.154 4.356.8 1.19.952 1.73 2.406 1.416 3.816h.792a2.77 2.77 0 0 1 2.502 1.588m-2.13 7.189v-4.8m2.398 2.4-2.4-2.4-2.4 2.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Upload.displayName = 'Upload';
