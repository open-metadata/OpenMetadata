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

export const DollarBag: FC<Props> = ({
  size = 20,
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
      d="M10 17.999c5.544 0 7.672-1.64 7.112-5.6C16.716 9.6 13.848 6.8 12 6H8c-1.848.8-4.716 3.6-5.113 6.4-.56 3.958 1.569 5.599 7.113 5.599M11.6 6c.8-.4 1.6-1.599 1.6-2.799C13.2 2.538 12.662 2 12 2H8.002c-.663 0-1.201.538-1.201 1.201 0 1.2.8 2.399 1.6 2.799"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10 14.4h.4a1.2 1.2 0 0 0 0-2.4h-.8a1.2 1.2 0 1 1 0-2.4h.4m0 4.8H8.4m1.6 0v.8m0-5.6h1.6m-1.6 0v-.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DollarBag.displayName = 'DollarBag';
