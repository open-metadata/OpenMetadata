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

export const DataContract: FC<Props> = ({
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
      d="M16 8.4c0-3.017 0-4.525-.937-5.463S12.617 2 9.6 2h-.8c-3.017 0-4.525 0-5.462.937C2.4 3.874 2.4 5.383 2.4 8.4v3.2c0 3.017 0 4.525.938 5.463S5.783 18 8.8 18H10M6 6h6.4M6 10h5.2m1.889 8.002h3.422c.708 0 1.307-.482 1.012-.998-.472-.828-1.514-1.402-2.723-1.402-1.21 0-2.25.574-2.723 1.402-.295.516.304.998 1.012.998"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.797 13.6a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DataContract.displayName = 'DataContract';
