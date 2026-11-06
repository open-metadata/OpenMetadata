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

export const HardDrive: FC<Props> = ({
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
      d="M2.083 10h15.833M5 13.333h3.333m-.86-10h5.055c.898 0 1.347 0 1.743.137a2.5 2.5 0 0 1 .934.578c.3.293.5.694.902 1.497l1.805 3.611c.158.315.237.473.292.638q.075.222.107.451c.024.173.024.348.024.701v1.721c0 1.4 0 2.1-.272 2.635a2.5 2.5 0 0 1-1.092 1.093c-.538.272-1.238.272-2.638.272H5.667c-1.4 0-2.1 0-2.635-.272a2.5 2.5 0 0 1-1.092-1.092c-.273-.536-.273-1.236-.273-2.636v-1.723c0-.352 0-.528.024-.7q.032-.23.107-.451c.055-.166.133-.323.292-.638l1.805-3.611c.402-.802.603-1.203.902-1.497a2.5 2.5 0 0 1 .933-.577c.397-.137.845-.137 1.743-.137"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
HardDrive.displayName = 'HardDrive';
