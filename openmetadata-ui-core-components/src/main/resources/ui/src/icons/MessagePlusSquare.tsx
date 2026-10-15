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

export const MessagePlusSquare: FC<Props> = ({
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
      d="M10 11.25v-5m-2.5 2.5h5M5.833 15v1.946c0 .444 0 .667.092.781a.42.42 0 0 0 .325.157c.147 0 .32-.139.667-.417l1.987-1.59c.406-.325.609-.487.835-.603a2.6 2.6 0 0 1 .635-.223c.249-.051.508-.051 1.029-.051H13.5c1.4 0 2.1 0 2.635-.272a2.5 2.5 0 0 0 1.093-1.092C17.5 13.1 17.5 12.4 17.5 11V6.5c0-1.4 0-2.1-.272-2.635a2.5 2.5 0 0 0-1.092-1.092C15.6 2.5 14.9 2.5 13.5 2.5h-7c-1.4 0-2.1 0-2.635.273a2.5 2.5 0 0 0-1.092 1.093C2.5 4.4 2.5 5.1 2.5 6.5v5.167c0 .775 0 1.163.085 1.481a2.5 2.5 0 0 0 1.768 1.767c.318.085.705.085 1.48.085"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MessagePlusSquare.displayName = 'MessagePlusSquare';
