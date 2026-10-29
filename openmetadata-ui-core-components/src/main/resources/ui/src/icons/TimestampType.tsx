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

export const TimestampType: FC<Props> = ({
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
      d="M10.173 14.943H4.106a1.62 1.62 0 0 1-1.618-1.618v-.484c0-.68.426-1.288 1.065-1.521l2.91-1.058a.81.81 0 0 0 .527-.676l.266-2.528c.054-.516-.177-1.011-.426-1.467a2.427 2.427 0 1 1 4.26 0c-.25.456-.48.95-.426 1.467l.265 2.528a.81.81 0 0 0 .528.676l2.356.857M2.488 17.371h7.685m4.6.628a2.742 2.742 0 1 0 0-5.483 2.742 2.742 0 0 0 0 5.483"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.676 14.594v.994l.663.331"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TimestampType.displayName = 'TimestampType';
