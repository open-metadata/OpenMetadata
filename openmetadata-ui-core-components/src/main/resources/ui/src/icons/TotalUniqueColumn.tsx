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

export const TotalUniqueColumn: FC<Props> = ({
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
      d="M17.252 7.768V4.634c0-1.096-.949-1.986-2.119-1.986H4.118C2.948 2.648 2 3.538 2 4.634v10.327c0 1.097.948 1.986 2.118 1.986h5.243M6.766 2.648v14.299m5.719-14.299v5.204"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m14.877 10.342.665 1.34c.09.186.332.365.536.4l1.204.201c.77.13.951.693.396 1.249l-.936.944a.83.83 0 0 0-.196.689l.268 1.169c.211.924-.276 1.282-1.087.799l-1.13-.674a.81.81 0 0 0-.747 0l-1.128.674c-.808.483-1.3.122-1.088-.8l.268-1.168a.83.83 0 0 0-.196-.69l-.936-.943c-.551-.556-.374-1.12.396-1.249l1.204-.201a.82.82 0 0 0 .533-.4l.664-1.34c.363-.727.951-.727 1.31 0M2 7.89h15.252"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TotalUniqueColumn.displayName = 'TotalUniqueColumn';
