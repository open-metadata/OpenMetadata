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

export const AppQueryRunner: FC<Props> = ({
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
      d="M12.4 3.602H7.6c-2.64 0-3.96 0-4.78.82S2 6.562 2 9.202v1.6c0 2.64 0 3.96.82 4.78s2.14.82 4.78.82h4.8c2.64 0 3.96 0 4.78-.82s.82-2.14.82-4.78v-1.6c0-2.64 0-3.96-.82-4.78s-2.14-.82-4.78-.82m-10 3.203h15.2M10 13.203h3.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m6 10 .981.846c.413.355.619.533.619.754s-.206.399-.619.754L6 13.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppQueryRunner.displayName = 'AppQueryRunner';
