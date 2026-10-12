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

export const PermissionDebugger: FC<Props> = ({
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
      d="M8.758 8.79a3.395 3.395 0 1 0 0-6.79 3.395 3.395 0 0 0 0 6.79m-6.305 8.73v-1.97c0-1.205.543-2.386 1.639-2.886 1.337-.61 2.94-.965 4.665-.965a12 12 0 0 1 2.496.258m6.292 1.517a2.263 2.263 0 0 1-2.567 2.242c-.163-.022-.245-.033-.297-.025a.3.3 0 0 0-.13.044c-.046.025-.091.07-.181.16l-1.927 1.928a.7.7 0 0 1-.136.12.4.4 0 0 1-.11.046c-.042.01-.089.01-.18.01h-.656c-.211 0-.317 0-.397-.04a.4.4 0 0 1-.165-.165c-.041-.081-.041-.187-.041-.398v-.655c0-.093 0-.139.01-.182a.4.4 0 0 1 .045-.109 1 1 0 0 1 .121-.136l1.928-1.927c.09-.09.134-.135.16-.18a.3.3 0 0 0 .044-.132c.007-.051-.004-.133-.026-.297a2.263 2.263 0 1 1 4.505-.304m-2.264-.001h.004"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
PermissionDebugger.displayName = 'PermissionDebugger';
