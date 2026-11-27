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

export const ChangeHierarchy02: FC<Props> = ({
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
    <path
      d="M16.047 2H8.92c-.554 0-.83 0-1.049.09a1.2 1.2 0 0 0-.643.643c-.09.219-.09.496-.09 1.05 0 .553 0 .83.09 1.048.12.29.352.522.643.643.218.09.495.09 1.049.09h7.128c.554 0 .83 0 1.049-.09.29-.12.522-.352.643-.643.09-.219.09-.495.09-1.049s0-.83-.09-1.049a1.2 1.2 0 0 0-.643-.643C16.877 2 16.6 2 16.047 2M8.918 3.781h.006m1.777 0h.006m5.34 10.657H8.92c-.554 0-.83 0-1.049.09-.291.12-.522.352-.643.643-.09.218-.09.495-.09 1.049s0 .83.09 1.048c.12.291.352.523.643.643.218.09.495.09 1.049.09h7.128c.554 0 .83 0 1.049-.09.29-.12.522-.352.643-.643.09-.218.09-.495.09-1.048 0-.554 0-.83-.09-1.05a1.2 1.2 0 0 0-.643-.642c-.219-.09-.495-.09-1.049-.09m-7.13 1.781h.006m1.777 0h.006m.375-7.91H3.954c-.554 0-.83 0-1.049.09-.29.12-.522.352-.643.643-.09.218-.09.495-.09 1.049s0 .83.09 1.048c.12.291.352.523.643.643.219.09.495.09 1.049.09h7.128c.554 0 .83 0 1.049-.09.291-.12.522-.352.643-.643.09-.218.09-.495.09-1.048 0-.554 0-.83-.09-1.049a1.2 1.2 0 0 0-.643-.643c-.219-.09-.495-.09-1.049-.09M3.953 10.09h.006m1.777 0h.006m10.42 1.844v-4.19m1.666 3.043-1.666 1.666-1.666-1.666M3.838 2.52v4.189m1.666-3.043L3.838 2 2.172 3.666"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ChangeHierarchy02.displayName = 'ChangeHierarchy02';
