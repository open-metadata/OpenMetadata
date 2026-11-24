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

export const AiAutomation02Filled: FC<Props> = ({
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
      d="M9.299 7.836v3.283a.2.2 0 0 0 .11.178l1.836.918"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M16.54 9.833q.058.453.058.923a7.3 7.3 0 1 1-6.36-7.24"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      clipRule="evenodd"
      d="M12.61 4.661a3 3 0 0 1-.256.059h-.003l-.005.001-.032.006h-.006c-.12.023-.12.194 0 .217h.006l.032.007h.005l.003.001a3 3 0 0 1 .441.114 3.3 3.3 0 0 1 2.198 2.525v.004l.002.004q0 .01.005.032l.001.006c.023.12.194.12.216 0l.001-.006.006-.032v-.004l.001-.004a4 4 0 0 1 .059-.257q.025-.093.055-.184a3.3 3.3 0 0 1 2.525-2.198h.004l.005-.001.031-.006.006-.001c.12-.023.12-.194 0-.216l-.006-.001-.017-.003-.014-.003h-.005l-.004-.001a4 4 0 0 1-.256-.059 3.3 3.3 0 0 1-2.382-2.58l-.001-.004-.001-.005-.002-.01-.004-.02v-.007c-.023-.12-.194-.12-.217 0v.005l-.006.032-.001.005-.001.004a4 4 0 0 1-.058.256 3.3 3.3 0 0 1-2.324 2.324Z"
      fill="currentColor"
      fillRule="evenodd"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AiAutomation02Filled.displayName = 'AiAutomation02Filled';
