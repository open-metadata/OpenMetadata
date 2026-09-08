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

export const Docs: FC<Props> = ({
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
      d="M11.998 15.6h-1.6c-2.263 0-3.394 0-4.097-.703s-.703-1.834-.703-4.097v-4c0-2.263 0-3.394.703-4.097S8.135 2 10.398 2h1.074c.654 0 .981 0 1.275.122s.525.353.988.815l2.125 2.126c.463.462.694.693.816.987s.122.621.122 1.275V10.8c0 2.263 0 3.394-.703 4.097s-1.835.703-4.097.703"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.402 2.398v.8c0 1.509 0 2.263.469 2.732.469.468 1.223.468 2.731.468h.8m-10.802-2a2.4 2.4 0 0 0-2.4 2.4v6.4c0 2.263 0 3.395.702 4.098.703.702 1.834.702 4.097.702h4a2.4 2.4 0 0 0 2.4-2.4M8.402 9.2h3.2m-3.2 3.2h5.6"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Docs.displayName = 'Docs';
