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

export const Notification: FC<Props> = ({
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
      d="M8.973 3.5a4.716 4.716 0 0 0-4.718 4.717v1.488c0 .482-.198 1.204-.446 1.615l-.9 1.502c-.552.928-.17 1.962.85 2.302a16.53 16.53 0 0 0 10.434 0 1.572 1.572 0 0 0 .85-2.302l-.9-1.502"
      stroke="currentColor"
      strokeMiterlimit={10}
      strokeWidth={1.3}
    />
    <path
      d="M11.315 15.406a2.367 2.367 0 0 1-2.359 2.359c-.644 0-1.24-.27-1.664-.694a2.36 2.36 0 0 1-.694-1.665"
      stroke="currentColor"
      strokeMiterlimit={10}
      strokeWidth={1.3}
    />
    <path
      className="tw:fill-utility-error-500 tw:stroke-utility-error-500"
      d="M14.199 2.234a3.146 3.146 0 1 0 0 6.292 3.146 3.146 0 1 0 0-6.292"
      fill="currentColor"
    />
  </svg>
);
Notification.displayName = 'Notification';
