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

export const Home02: FC<Props> = ({
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
      d="M7.5 17.5v-6.167c0-.467 0-.7.091-.878a.83.83 0 0 1 .364-.364C8.133 10 8.367 10 8.833 10h2.333c.467 0 .7 0 .878.091a.83.83 0 0 1 .364.364c.092.178.092.412.092.878V17.5M9.182 2.303 3.529 6.699c-.377.294-.567.442-.702.625a1.7 1.7 0 0 0-.265.542c-.062.221-.062.46-.062.938v6.029c0 .933 0 1.4.182 1.757a1.67 1.67 0 0 0 .728.728c.357.182.823.182 1.757.182h9.667c.933 0 1.4 0 1.757-.182a1.67 1.67 0 0 0 .728-.728c.181-.357.181-.823.181-1.757V8.804c0-.478 0-.717-.062-.938a1.7 1.7 0 0 0-.265-.542c-.136-.183-.325-.331-.702-.625l-5.653-4.396c-.292-.228-.439-.342-.6-.385a.83.83 0 0 0-.436 0c-.162.043-.308.158-.601.385Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Home02.displayName = 'Home02';
