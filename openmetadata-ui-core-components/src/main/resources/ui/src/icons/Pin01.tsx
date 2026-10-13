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

export const Pin01: FC<Props> = ({
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
      d="M6.752 13.248 2 18M9.539 5.71 8.228 7.02a1.7 1.7 0 0 1-.222.204 1 1 0 0 1-.174.093 2 2 0 0 1-.291.071l-3.078.616c-.8.16-1.2.24-1.387.45a.84.84 0 0 0-.204.674c.039.279.327.567.904 1.144l5.952 5.952c.577.577.865.866 1.144.904a.84.84 0 0 0 .673-.204c.211-.187.291-.587.451-1.387l.616-3.078c.03-.148.044-.222.071-.291a1 1 0 0 1 .093-.174 2 2 0 0 1 .203-.221l1.311-1.312c.069-.068.103-.102.14-.132a1 1 0 0 1 .106-.072c.042-.024.087-.043.175-.08l2.096-.899c.61-.262.917-.393 1.055-.604a.84.84 0 0 0 .121-.628c-.05-.248-.285-.483-.755-.953l-4.32-4.32c-.47-.47-.706-.706-.954-.756a.84.84 0 0 0-.628.12c-.211.14-.342.445-.604 1.056L9.824 5.29a2 2 0 0 1-.081.175 1 1 0 0 1-.072.105c-.03.038-.064.072-.132.14"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Pin01.displayName = 'Pin01';
