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

export const Archive: FC<Props> = ({
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
      d="M18 13.8V9.2A2.2 2.2 0 0 0 15.8 7h-2.307a2.2 2.2 0 0 0-1.334.45l-.722.55c-.775.59-1.85.59-2.624 0l-.722-.55A2.2 2.2 0 0 0 6.757 7H4.2A2.2 2.2 0 0 0 2 9.2v4.6A2.2 2.2 0 0 0 4.2 16h11.6a2.2 2.2 0 0 0 2.2-2.2M3 4h14m-8 9h2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Archive.displayName = 'Archive';
