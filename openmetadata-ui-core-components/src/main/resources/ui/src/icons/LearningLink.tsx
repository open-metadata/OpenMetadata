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

export const LearningLink: FC<Props> = ({
  size = 24,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M2 4a4 4 0 0 1 4-4h6l6 6v10a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"
      fill="#079455"
    />
    <path d="m12 0 6 6h-2a4 4 0 0 1-4-4z" fill="#fff" opacity={0.3} />
    <path
      d="m10.236 14.12-.472.472a1.666 1.666 0 1 1-2.356-2.356l.47-.472m4.243.471.471-.471a1.666 1.666 0 0 0-2.356-2.357l-.472.471m-.93 3.288 2.332-2.333"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
LearningLink.displayName = 'LearningLink';
