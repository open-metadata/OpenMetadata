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

export const Documents: FC<Props> = ({
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
      d="M3 14.899V6.883c0-1.01 0-1.516.17-1.912A2.1 2.1 0 0 1 4.272 3.87c.396-.17.897-.17 1.912-.17h.346a1.4 1.4 0 0 1 1.09.52L8.892 5.8m0 0H12.8c.98 0 1.47 0 1.845.19.329.168.597.435.764.765.191.374.191.864.191 1.844v.7M8.892 5.8H6.5"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m3.81 12.46.21-.52c.513-1.278.77-1.917 1.306-2.278C5.86 9.3 6.553 9.3 7.936 9.3h5.642c1.882 0 2.823 0 3.242.615.418.615.068 1.485-.63 3.225l-.21.52c-.513 1.278-.77 1.918-1.306 2.279-.535.36-1.227.36-2.61.36H6.422c-1.882 0-2.823 0-3.242-.615-.418-.615-.068-1.485.63-3.224"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Documents.displayName = 'Documents';
