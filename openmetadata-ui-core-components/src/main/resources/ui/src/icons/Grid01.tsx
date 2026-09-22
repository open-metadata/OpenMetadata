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

export const Grid01: FC<Props> = ({
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
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path d="M8.4 3H4.6c-.56 0-.84 0-1.054.109a1 1 0 0 0-.437.437C3 3.76 3 4.04 3 4.6v3.8c0 .56 0 .84.109 1.054a1 1 0 0 0 .437.437C3.76 10 4.04 10 4.6 10h3.8c.56 0 .84 0 1.054-.109a1 1 0 0 0 .437-.437C10 9.24 10 8.96 10 8.4V4.6c0-.56 0-.84-.109-1.054a1 1 0 0 0-.437-.437C9.24 3 8.96 3 8.4 3m11 0h-3.8c-.56 0-.84 0-1.054.109a1 1 0 0 0-.437.437C14 3.76 14 4.04 14 4.6v3.8c0 .56 0 .84.109 1.054a1 1 0 0 0 .437.437C14.76 10 15.04 10 15.6 10h3.8c.56 0 .84 0 1.054-.109a1 1 0 0 0 .437-.437C21 9.24 21 8.96 21 8.4V4.6c0-.56 0-.84-.109-1.054a1 1 0 0 0-.437-.437C20.24 3 19.96 3 19.4 3m0 11h-3.8c-.56 0-.84 0-1.054.109a1 1 0 0 0-.437.437C14 14.76 14 15.04 14 15.6v3.8c0 .56 0 .84.109 1.054a1 1 0 0 0 .437.437C14.76 21 15.04 21 15.6 21h3.8c.56 0 .84 0 1.054-.109a1 1 0 0 0 .437-.437C21 20.24 21 19.96 21 19.4v-3.8c0-.56 0-.84-.109-1.054a1 1 0 0 0-.437-.437C20.24 14 19.96 14 19.4 14m-11 0H4.6c-.56 0-.84 0-1.054.109a1 1 0 0 0-.437.437C3 14.76 3 15.04 3 15.6v3.8c0 .56 0 .84.109 1.054a1 1 0 0 0 .437.437C3.76 21 4.04 21 4.6 21h3.8c.56 0 .84 0 1.054-.109a1 1 0 0 0 .437-.437C10 20.24 10 19.96 10 19.4v-3.8c0-.56 0-.84-.109-1.054a1 1 0 0 0-.437-.437C9.24 14 8.96 14 8.4 14" />
  </svg>
);
Grid01.displayName = 'Grid01';
