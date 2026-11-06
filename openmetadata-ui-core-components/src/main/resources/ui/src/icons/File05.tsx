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

export const File05: FC<Props> = ({
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
      d="M11.667 1.892v3.441c0 .467 0 .7.091.878a.83.83 0 0 0 .364.364c.178.092.412.092.878.092h3.442m-4.775 7.5h-5m6.667-3.333H6.667m10-2.51v6.009c0 1.4 0 2.1-.272 2.635a2.5 2.5 0 0 1-1.092 1.093c-.536.272-1.236.272-2.636.272H7.333c-1.4 0-2.1 0-2.635-.272a2.5 2.5 0 0 1-1.092-1.092c-.273-.536-.273-1.236-.273-2.636V5.667c0-1.4 0-2.1.273-2.635A2.5 2.5 0 0 1 4.699 1.94c.534-.273 1.234-.273 2.634-.273h2.677c.611 0 .917 0 1.205.069q.384.093.723.3c.253.154.468.37.9.803l2.658 2.657c.432.433.648.648.803.901a2.5 2.5 0 0 1 .3.723c.068.288.068.593.068 1.205Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
File05.displayName = 'File05';
