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

export const Dataflow04: FC<Props> = ({
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
      d="M3.333 15v-.167c0-1.4 0-2.1.273-2.635a2.5 2.5 0 0 1 1.093-1.092c.534-.273 1.234-.273 2.634-.273h5.333c1.4 0 2.1 0 2.635.273a2.5 2.5 0 0 1 1.093 1.093c.273.534.273 1.234.273 2.634V15M3.333 15a1.667 1.667 0 1 0 0 3.333 1.667 1.667 0 0 0 0-3.333m13.333 0a1.667 1.667 0 1 0 0 3.333 1.667 1.667 0 0 0 0-3.333m-6.667 0a1.667 1.667 0 1 0 0 3.333 1.667 1.667 0 0 0 0-3.333m0 0V6.667M5 6.667h10c.777 0 1.165 0 1.471-.127a1.67 1.67 0 0 0 .903-.902c.126-.306.126-.695.126-1.471s0-1.165-.127-1.471a1.67 1.67 0 0 0-.902-.902c-.306-.127-.694-.127-1.471-.127H5c-.777 0-1.165 0-1.471.127a1.67 1.67 0 0 0-.902.903c-.127.305-.127.693-.127 1.47s0 1.165.127 1.471a1.67 1.67 0 0 0 .903.903c.305.126.693.126 1.47.126"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Dataflow04.displayName = 'Dataflow04';
