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

export const Function: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <g clipPath="url(#a)">
      <path
        d="M5.083 19.497c1.552 0 2.376-1.387 2.618-2.205q1.06-4.391 2.142-8.78h2.382a.812.812 0 0 0 0-1.623h-1.98c.214-.849.37-1.454.431-1.66l.069-.231c.252-.86.84-2.87 1.75-2.87.846 0 .972 1.3.978 1.364a.812.812 0 0 0 1.618-.129c-.076-.988-.716-2.86-2.595-2.86-2.128 0-2.924 2.728-3.31 4.037l-.065.222c-.077.26-.283 1.059-.548 2.127H5.732a.812.812 0 1 0 0 1.624h2.44a2035 2035 0 0 0-2.03 8.328c-.044.13-.377 1.033-1.057 1.033-1.04 0-1.49-1.46-1.493-1.47a.812.812 0 0 0-1.56.45c.285.982 1.245 2.643 3.05 2.643m12.036-2.093c.479 0 .881-.34.881-.881 0-.252-.1-.478-.315-.73L16 13.857l1.636-1.912c.15-.19.263-.391.263-.655 0-.478-.39-.83-.893-.83-.339 0-.604.213-.83.491l-1.27 1.66-1.246-1.66c-.252-.315-.515-.491-.893-.491-.478 0-.88.34-.88.88 0 .252.1.479.314.73l1.573 1.812-1.723 2.037a.96.96 0 0 0-.264.654c0 .478.39.83.893.83.34 0 .603-.213.83-.49l1.357-1.786 1.358 1.785c.253.315.518.492.894.492"
        fill="currentColor"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path d="M0 0h20v20H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
Function.displayName = 'Function';
