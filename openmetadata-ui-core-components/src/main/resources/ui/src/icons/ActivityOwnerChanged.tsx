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

export const ActivityOwnerChanged: FC<Props> = ({
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
    viewBox="0 0 12 12"
    width={size}
    {...props}>
    <path
      d="M4.626 6.951h-.714c-.665 0-.997 0-1.267.082a1.9 1.9 0 0 0-1.27 1.27c-.082.27-.082.603-.082 1.267m5.951-6.427a2.143 2.143 0 1 1-4.285 0 2.143 2.143 0 0 1 4.285 0m1.401 4.034a1.47 1.47 0 1 1 0 2.941m1.277-2.2.782-.447m-.782 1.906.782.447m-2.06-2.647a1.47 1.47 0 1 0 0 2.941m0 0v.883M7.369 7.918l-.782-.447m.782 1.906-.782.447m2.059-2.647v-.882"
      stroke="currentColor"
    />
  </svg>
);
ActivityOwnerChanged.displayName = 'ActivityOwnerChanged';
