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

export const Reply: FC<Props> = ({
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
      d="M10.98 7.398v-3.77c0-.485 0-.728-.1-.85a.44.44 0 0 0-.35-.16c-.156.003-.34.161-.71.477L2.386 9.467c-.214.184-.32.276-.36.385a.44.44 0 0 0 0 .297c.04.109.146.2.36.384l7.434 6.372c.37.316.553.474.71.478a.44.44 0 0 0 .35-.161c.1-.121.1-.364.1-.85v-3.677A10 10 0 0 1 18 16.286v-.537a8.48 8.48 0 0 0-7.02-8.351"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Reply.displayName = 'Reply';
