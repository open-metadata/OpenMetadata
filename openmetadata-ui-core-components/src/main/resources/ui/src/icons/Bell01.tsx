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

export const Bell01: FC<Props> = ({
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
      d="M7.795 17.5c.588.518 1.36.833 2.205.833s1.617-.315 2.205-.833M15 6.667a5 5 0 1 0-10 0c0 2.575-.65 4.338-1.375 5.504-.612.983-.918 1.476-.907 1.613.013.152.045.21.167.3.111.083.61.083 1.607.083h11.016c.997 0 1.496 0 1.606-.082.123-.092.155-.149.167-.301.012-.137-.294-.629-.907-1.613C15.65 11.005 15 9.242 15 6.667"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Bell01.displayName = 'Bell01';
