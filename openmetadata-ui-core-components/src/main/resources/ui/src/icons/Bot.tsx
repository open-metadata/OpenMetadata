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

export const Bot: FC<Props> = ({
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
      d="M15.6 13.2v-1.6c0-2.262 0-3.393-.703-4.096S13.063 6.8 10.8 6.8H9.2c-2.262 0-3.394 0-4.097.703S4.4 9.338 4.4 11.6v1.6c0 2.262 0 3.394.703 4.097S6.938 18 9.2 18h1.6c2.263 0 3.394 0 4.097-.703s.703-1.834.703-4.097m.002 1.6c1.13 0 1.697 0 2.048-.351.352-.352.352-.918.352-2.049s0-1.697-.352-2.049C17.3 10 16.733 10 15.602 10"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M4.4 14.8c-1.131 0-1.697 0-2.049-.351C2 14.097 2 13.53 2 12.4s0-1.697.351-2.049C2.703 10 3.27 10 4.4 10m6.8-6.8a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0M10 4.398v2.4m-2.4 3.999v.8m4.8-.8v.8m-4 2.801s.534.4 1.6.4 1.6-.4 1.6-.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Bot.displayName = 'Bot';
