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

export const ThumbsDownFilled: FC<Props> = ({
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
      d="M14.167 1.667H6.765c-1.217 0-1.827 0-2.318.223a2.5 2.5 0 0 0-1.064.911c-.295.452-.387 1.054-.573 2.258l-.436 2.833c-.244 1.587-.367 2.381-.131 2.998a2.5 2.5 0 0 0 1.1 1.283c.577.327 1.38.327 2.986.327H7c.467 0 .7 0 .878.091a.83.83 0 0 1 .364.364c.092.178.092.412.092.878v2.445a2.055 2.055 0 0 0 2.054 2.055.68.68 0 0 0 .626-.407l2.8-6.302.353-.791Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      className="tw:fill-bg-primary"
      d="M14.167 1.667h1.5c.933 0 1.4 0 1.757.182a1.67 1.67 0 0 1 .728.728c.181.356.181.823.181 1.756v3.833c0 .933 0 1.4-.182 1.757a1.67 1.67 0 0 1-.728.728c-.356.182-.823.182-1.756.182h-1.5Z"
      fill="#fff"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ThumbsDownFilled.displayName = 'ThumbsDownFilled';
