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

export const AiApplication: FC<Props> = ({
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
      d="M7.6 2v1.6M12.4 2v1.6M7.6 16.4V18m4.8-1.6V18m4-10.4H18m-1.6 4H18m-16-4h1.6m-1.6 4h1.6m3.84 4.8h5.12c1.344 0 2.016 0 2.53-.262a2.4 2.4 0 0 0 1.048-1.048c.262-.514.262-1.186.262-2.53V7.44c0-1.344 0-2.016-.262-2.53a2.4 2.4 0 0 0-1.048-1.048c-.514-.262-1.186-.262-2.53-.262H7.44c-1.344 0-2.016 0-2.53.262A2.4 2.4 0 0 0 3.862 4.91C3.6 5.424 3.6 6.096 3.6 7.44v5.12c0 1.344 0 2.016.262 2.53a2.4 2.4 0 0 0 1.048 1.048c.514.262 1.186.262 2.53.262m.053-6.174a3 3 0 0 1-.257.059h-.003l-.005.001-.032.006-.005.001c-.12.023-.12.193 0 .216l.005.001.032.006h.005l.003.001a4 4 0 0 1 .257.059q.094.024.185.055a3.3 3.3 0 0 1 2.197 2.525l.001.004.001.005.006.03v.007c.023.12.194.12.217 0v-.006l.006-.031.001-.005v-.004a4 4 0 0 1 .06-.257q.024-.093.055-.184a3.3 3.3 0 0 1 2.49-2.191l.035-.007h.003l.005-.001.032-.006.006-.001c.119-.023.119-.193 0-.216h-.006l-.017-.004-.015-.003h-.005l-.003-.001a4 4 0 0 1-.257-.059 3.3 3.3 0 0 1-2.382-2.58v-.004l-.002-.005-.002-.01-.003-.02L10.1 7.6c-.023-.12-.194-.12-.216 0l-.001.006-.006.031v.005l-.002.004a4 4 0 0 1-.058.257 3.3 3.3 0 0 1-2.324 2.324"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AiApplication.displayName = 'AiApplication';
