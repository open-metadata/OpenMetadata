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

export const EnumType: FC<Props> = ({
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
      d="M10 4.402h8m-8 3.2h4.8m-4.8 4.8h8m-8 3.2h4.8M2 6.002c0-.746 0-1.119.122-1.413a1.6 1.6 0 0 1 .866-.866c.294-.121.666-.121 1.412-.121s1.118 0 1.412.121a1.6 1.6 0 0 1 .866.866c.122.294.122.667.122 1.413 0 .745 0 1.118-.122 1.412a1.6 1.6 0 0 1-.866.866c-.294.122-.667.122-1.412.122-.746 0-1.118 0-1.412-.122a1.6 1.6 0 0 1-.866-.866C2 7.12 2 6.747 2 6.002m0 8c0-.746 0-1.119.122-1.413a1.6 1.6 0 0 1 .866-.866c.294-.121.666-.121 1.412-.121s1.118 0 1.412.121a1.6 1.6 0 0 1 .866.866c.122.294.122.667.122 1.412 0 .746 0 1.119-.122 1.413a1.6 1.6 0 0 1-.866.866c-.294.121-.667.121-1.412.121-.746 0-1.118 0-1.412-.121a1.6 1.6 0 0 1-.866-.866C2 15.12 2 14.747 2 14.002"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
EnumType.displayName = 'EnumType';
