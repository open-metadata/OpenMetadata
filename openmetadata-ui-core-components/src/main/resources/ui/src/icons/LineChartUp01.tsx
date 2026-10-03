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

export const LineChartUp01: FC<Props> = ({
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
      d="M18 18H3.422c-.498 0-.747 0-.937-.097a.9.9 0 0 1-.388-.388C2 17.325 2 17.075 2 16.578V2m15.111 4.444-3.483 3.718c-.132.141-.198.212-.278.248a.44.44 0 0 1-.225.039c-.087-.008-.173-.053-.344-.142L9.886 8.804c-.172-.09-.257-.134-.345-.141a.45.45 0 0 0-.224.038c-.08.036-.146.107-.278.248l-3.483 3.718"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
LineChartUp01.displayName = 'LineChartUp01';
