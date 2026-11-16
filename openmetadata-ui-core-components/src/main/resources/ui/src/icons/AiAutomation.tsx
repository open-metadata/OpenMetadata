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

export const AiAutomation: FC<Props> = ({
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
      d="M9.305 7.852v3.26c0 .075.042.143.11.177l1.823.911"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M16.495 9.835q.058.45.058.917a7.248 7.248 0 1 1-6.317-7.189m2.359 1.134a3 3 0 0 1-.256.058h-.003l-.005.001-.031.006-.006.001c-.119.022-.119.192 0 .215h.006l.031.006.005.001h.003a4 4 0 0 1 .255.059 3.28 3.28 0 0 1 2.366 2.562v.004l.001.005.006.03.001.007c.023.118.192.118.215 0v-.006l.006-.031.001-.005v-.004a4 4 0 0 1 .059-.255q.025-.093.055-.183a3.28 3.28 0 0 1 2.507-2.182h.004l.005-.002.031-.005.006-.001c.118-.023.118-.192 0-.215h-.006l-.017-.004-.014-.003h-.005l-.004-.001-.035-.007a3 3 0 0 1-.403-.106 3.28 3.28 0 0 1-2.182-2.508v-.003l-.002-.005-.002-.01-.003-.02-.001-.007c-.023-.119-.192-.119-.215 0v.005l-.007.032v.005l-.001.003a4 4 0 0 1-.058.255 3.27 3.27 0 0 1-2.307 2.308Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AiAutomation.displayName = 'AiAutomation';
