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

export const DefaultTime: FC<Props> = ({
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
      d="M18 10a8 8 0 1 0-10.505 7.6m.105-6 1.51-1.006A2 2 0 0 0 10 8.93V5.734"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.799 13.203h1.6a.8.8 0 0 1 .8.8v.8a.8.8 0 0 1-.8.8h-.8a.8.8 0 0 0-.8.8v.8a.8.8 0 0 0 .8.8h1.6m4.799-4.8v2.4m0 0h-1.6a.8.8 0 0 1-.8-.8v-1.6m2.4 2.4v2.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DefaultTime.displayName = 'DefaultTime';
