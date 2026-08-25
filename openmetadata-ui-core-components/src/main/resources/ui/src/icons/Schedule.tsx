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

export const Schedule: FC<Props> = ({
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
      d="M10 6.8V10l1.2 1.2m4.835 2.36c1.309.708 1.963 1.061 1.963 1.638s-.654.93-1.963 1.637l-.891.481c-1.005.543-1.508.814-1.75.617-.591-.483.33-1.73.557-2.172.23-.448.226-.686 0-1.126-.226-.442-1.149-1.689-.557-2.172.242-.198.745.074 1.75.617z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.82 17.955a7.998 7.998 0 1 1 7.018-6.357"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Schedule.displayName = 'Schedule';
