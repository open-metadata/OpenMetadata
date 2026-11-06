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

export const DatabaseSchema: FC<Props> = ({
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
      d="M10 8.61c1.768 0 3.201-.622 3.201-1.389s-1.433-1.389-3.2-1.389-3.2.622-3.2 1.39c0 .766 1.433 1.388 3.2 1.388m3.2 1.39c0 .767-1.433 1.39-3.2 1.39S6.8 10.766 6.8 10"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.201 7.223v5.556c0 .767-1.433 1.39-3.2 1.39s-3.2-.623-3.2-1.39V7.223M14.8 2h1.6c.755 0 1.132 0 1.367.234C18 2.47 18 2.846 18 3.6v1.6m-.4-2.8-2.8 2.8M5.2 2H3.6c-.754 0-1.131 0-1.366.234C2 2.47 2 2.846 2 3.6v1.6m.4-2.8 2.8 2.8M14.8 18h1.6c.755 0 1.132 0 1.367-.233.234-.235.234-.612.234-1.366v-1.6m-.4 2.8-2.8-2.8M5.2 18H3.6c-.754 0-1.131 0-1.366-.233C2 17.532 2 17.155 2 16.4v-1.6m.4 2.8 2.8-2.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DatabaseSchema.displayName = 'DatabaseSchema';
