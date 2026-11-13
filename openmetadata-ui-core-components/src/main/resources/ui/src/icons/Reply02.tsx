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

export const Reply02: FC<Props> = ({
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
      d="M11.363 8.695h-5.6m2.8 2.792h-2.8m2.501 5.623c-3.347-.222-6.012-2.925-6.232-6.319a16 16 0 0 1 0-2.016c.22-3.394 2.885-6.097 6.232-6.32a27 27 0 0 1 3.473 0c3.346.223 6.012 2.926 6.23 6.32.044.664.044 1.352 0 2.016-.08 1.236-.626 2.38-1.27 3.347-.373.677-.126 1.521.263 2.259.28.532.42.797.308.99-.113.192-.364.198-.867.21-.996.024-1.667-.258-2.2-.65-.302-.224-.453-.335-.557-.348s-.31.072-.72.24a3.9 3.9 0 0 1-1.187.272 26.5 26.5 0 0 1-3.473 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Reply02.displayName = 'Reply02';
