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

export const TagCategory: FC<Props> = ({
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
      d="m14.847 7.23-.8-.492C13.245 6.246 12.844 6 12.4 6s-.844.246-1.646.738l-.8.491c-.759.466-1.138.699-1.346 1.074S8.4 9.13 8.4 10.035v4.692c0 1.543 0 2.314.469 2.794C9.338 18 10.092 18 11.6 18h1.6c1.509 0 2.263 0 2.732-.48.468-.479.468-1.25.468-2.793v-4.692c0-.905 0-1.357-.207-1.732-.208-.375-.588-.608-1.346-1.074"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.6 6.086c-.511-.49-.817-.748-1.203-.845-.448-.113-.918.013-1.86.266l-.938.252c-.89.239-1.336.358-1.645.653-.31.295-.43.715-.669 1.554l-1.243 4.35c-.408 1.431-.613 2.146-.266 2.71.298.485 1.49 1.08 2.624 1.373"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.996 8.4c.673-.448 1.27-1.166 1.642-2.059.766-1.844.278-3.735-1.09-4.225-1.37-.489-3.1.61-3.867 2.453a5 5 0 0 0-.28.922"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TagCategory.displayName = 'TagCategory';
