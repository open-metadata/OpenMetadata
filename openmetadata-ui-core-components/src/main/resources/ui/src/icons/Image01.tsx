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

export const Image01: FC<Props> = ({
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
      d="M13.5 17.5H5.776c-.504 0-.757 0-.874-.1a.42.42 0 0 1-.144-.35c.012-.152.19-.331.548-.688l7.086-7.086c.33-.33.495-.495.685-.557a.83.83 0 0 1 .515 0c.19.062.355.227.685.557L17.5 12.5v1m-4 4c1.4 0 2.1 0 2.635-.272a2.5 2.5 0 0 0 1.093-1.092c.272-.536.272-1.236.272-2.636m-4 4h-7c-1.4 0-2.1 0-2.635-.272a2.5 2.5 0 0 1-1.092-1.092C2.5 15.6 2.5 14.9 2.5 13.5v-7c0-1.4 0-2.1.273-2.635a2.5 2.5 0 0 1 1.093-1.092C4.4 2.5 5.1 2.5 6.5 2.5h7c1.4 0 2.1 0 2.635.273a2.5 2.5 0 0 1 1.093 1.093C17.5 4.4 17.5 5.1 17.5 6.5v7M8.75 7.083a1.667 1.667 0 1 1-3.333 0 1.667 1.667 0 0 1 3.333 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Image01.displayName = 'Image01';
