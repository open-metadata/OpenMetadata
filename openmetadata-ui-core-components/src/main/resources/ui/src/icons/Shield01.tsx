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

export const Shield01: FC<Props> = ({
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
      d="M9.418 18.013c.184.108.277.162.407.189a.9.9 0 0 0 .35 0c.13-.028.223-.082.407-.189 1.623-.948 6.085-3.923 6.085-8.013V6.014c0-.666 0-.999-.108-1.285a1.7 1.7 0 0 0-.457-.658c-.229-.202-.542-.319-1.165-.553l-4.468-1.675a2 2 0 0 0-.349-.111.8.8 0 0 0-.238 0c-.089.013-.175.046-.349.111l-4.47 1.674c-.623.233-.935.351-1.165.553a1.7 1.7 0 0 0-.456.658c-.109.287-.109.62-.109 1.286V10c0 4.09 4.462 7.065 6.085 8.013"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Shield01.displayName = 'Shield01';
