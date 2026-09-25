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

export const Role: FC<Props> = ({
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
      d="M13.203 7.602h2.4m-2.4 3.198h2.4M4.398 13.685a3.6 3.6 0 0 1 1.24-1.739 3.26 3.26 0 0 1 1.96-.66c.703 0 1.388.23 1.961.66a3.6 3.6 0 0 1 1.24 1.74M7.56 9.52a1.6 1.6 0 1 0 .001-3.2 1.6 1.6 0 0 0 0 3.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.4 3.602H7.6c-2.64 0-3.96 0-4.78.82S2 6.562 2 9.202v1.6c0 2.64 0 3.96.82 4.78s2.14.82 4.78.82h4.8c2.64 0 3.96 0 4.78-.82s.82-2.14.82-4.78v-1.6c0-2.64 0-3.96-.82-4.78s-2.14-.82-4.78-.82"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Role.displayName = 'Role';
