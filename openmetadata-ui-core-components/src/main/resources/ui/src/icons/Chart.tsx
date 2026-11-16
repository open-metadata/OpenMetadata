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

export const Chart: FC<Props> = ({
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
      d="M18 18H8.222c-2.933 0-4.4 0-5.31-.911C2 16.177 2 14.71 2 11.778V2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M18 6.431c-.558-.706-1.315-1.26-2.48-1.26-4.924 0-2.156 7.556-7.447 7.556-1.173 0-1.926-.557-2.501-1.26"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Chart.displayName = 'Chart';
