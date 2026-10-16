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

export const MessageTextSquare01: FC<Props> = ({
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
      d="M5.833 7.083H10M5.833 10H12.5m-4.43 5h5.43c1.4 0 2.1 0 2.635-.272a2.5 2.5 0 0 0 1.093-1.092C17.5 13.1 17.5 12.4 17.5 11V6.5c0-1.4 0-2.1-.272-2.635a2.5 2.5 0 0 0-1.092-1.092C15.6 2.5 14.9 2.5 13.5 2.5h-7c-1.4 0-2.1 0-2.635.273a2.5 2.5 0 0 0-1.092 1.093C2.5 4.4 2.5 5.1 2.5 6.5v10.446c0 .444 0 .667.092.781a.42.42 0 0 0 .325.157c.147 0 .32-.139.667-.417l1.987-1.59c.407-.325.609-.487.835-.603a2.6 2.6 0 0 1 .635-.223C7.29 15 7.55 15 8.07 15"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MessageTextSquare01.displayName = 'MessageTextSquare01';
