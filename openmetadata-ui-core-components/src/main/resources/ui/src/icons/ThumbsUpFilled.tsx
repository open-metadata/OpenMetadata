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

export const ThumbsUpFilled: FC<Props> = ({
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
    viewBox="0 0 18 18"
    width={size}
    {...props}>
    <path
      d="m11.434 6.065-.187.603c-.152.493-.229.74-.17.934a.7.7 0 0 0 .294.383c.176.11.441.11.973.11h.283c1.8 0 2.699 0 3.124.533q.072.092.129.194c.327.594-.045 1.394-.788 2.994-.682 1.469-1.023 2.203-1.657 2.636a3 3 0 0 1-.188.118c-.667.382-1.493.382-3.145.382h-.358c-2.002 0-3.002 0-3.624-.602-.622-.603-.622-1.572-.622-3.512v-.681c0-1.02 0-1.529.18-1.995.182-.467.528-.85 1.22-1.617l2.865-3.172c.072-.08.108-.12.14-.147a.723.723 0 0 1 1.01.064c.027.032.058.076.118.164.095.137.142.206.183.274.37.61.481 1.335.312 2.023a6 6 0 0 1-.092.314"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      className="tw:fill-bg-primary"
      d="M2 9.35a1.4 1.4 0 0 1 1.4-1.4c1.16 0 2.1.94 2.1 2.1v2.8a2.1 2.1 0 0 1-2.1 2.1 1.4 1.4 0 0 1-1.4-1.4z"
      fill="#fff"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ThumbsUpFilled.displayName = 'ThumbsUpFilled';
