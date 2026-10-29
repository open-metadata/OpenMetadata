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

export const Share05: FC<Props> = ({
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
      d="M17.5 5h-2.667c-1.4 0-2.1 0-2.635.273a2.5 2.5 0 0 0-1.092 1.093C10.833 6.9 10.833 7.6 10.833 9v1M17.5 5 15 2.5M17.5 5 15 7.5m-6.667-5H6.5c-1.4 0-2.1 0-2.635.273a2.5 2.5 0 0 0-1.092 1.093C2.5 4.4 2.5 5.1 2.5 6.5v7c0 1.4 0 2.1.273 2.635a2.5 2.5 0 0 0 1.093 1.093C4.4 17.5 5.1 17.5 6.5 17.5h7c1.4 0 2.1 0 2.635-.272a2.5 2.5 0 0 0 1.093-1.092c.272-.536.272-1.236.272-2.636v-1.833"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Share05.displayName = 'Share05';
