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

export const Version: FC<Props> = ({
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
      d="M10 18a8 8 0 0 1 0-16c3.582 0 6.581 2.354 7.6 5.6h-2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10 6.8V10l1.6 1.601m6.363-.801q.035-.395.036-.8m-5.6 8q.41-.136.8-.313M17.03 14a9 9 0 0 0 .412-.923m-2.49 3.507q.413-.343.78-.739"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Version.displayName = 'Version';
