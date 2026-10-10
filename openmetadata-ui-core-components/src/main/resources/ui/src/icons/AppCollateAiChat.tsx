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

export const AppCollateAiChat: FC<Props> = ({
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
      d="M17.956 9.158q.045.416.044.842a8 8 0 0 1-11.79 7.047c-1.573-.848-2.631-.06-3.565.082a.45.45 0 0 1-.384-.131.54.54 0 0 1-.098-.592c.366-.863.703-2.5.244-3.88a8 8 0 0 1 8.435-10.483"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M15.027 2.021c.006-.028.046-.028.052 0a3.72 3.72 0 0 0 2.9 2.9c.028.006.028.046 0 .052a3.72 3.72 0 0 0-2.9 2.9.026.026 0 0 1-.052 0 3.72 3.72 0 0 0-2.9-2.9c-.029-.006-.029-.046 0-.051a3.72 3.72 0 0 0 2.9-2.9m-4.92 7.982H10m-3.263 0h-.106m3.58 0a.21.21 0 1 1-.421 0 .21.21 0 0 1 .42 0m-3.37 0a.21.21 0 1 1-.42 0 .21.21 0 0 1 .42 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppCollateAiChat.displayName = 'AppCollateAiChat';
