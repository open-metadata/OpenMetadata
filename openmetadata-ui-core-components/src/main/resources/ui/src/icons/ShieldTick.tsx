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

export const ShieldTick: FC<Props> = ({
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
      d="m7.5 9.583 1.667 1.667 3.75-3.75m3.75 2.5c0 4.09-4.462 7.065-6.085 8.013-.184.108-.277.162-.407.189a1 1 0 0 1-.35 0c-.13-.028-.223-.082-.407-.189C7.795 17.065 3.333 14.09 3.333 10V6.014c0-.666 0-.999.108-1.285a1.7 1.7 0 0 1 .457-.658c.23-.202.542-.319 1.165-.553l4.468-1.675c.173-.065.26-.097.349-.111a.8.8 0 0 1 .238 0c.089.013.175.046.349.111l4.468 1.675c.623.233.936.351 1.165.553a1.7 1.7 0 0 1 .456.658c.109.286.109.619.109 1.285V10Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ShieldTick.displayName = 'ShieldTick';
