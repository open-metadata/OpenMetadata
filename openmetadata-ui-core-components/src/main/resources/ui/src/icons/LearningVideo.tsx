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

export const LearningVideo: FC<Props> = ({
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
      fill="#D92D20"
    />
    <path d="m12 0 6 6h-2a4 4 0 0 1-4-4z" fill="#fff" opacity={0.3} />
    <g clipPath="url(#learning-video_a)">
      <path
        clipRule="evenodd"
        d="M14.478 9.014c.155.156.266.35.323.563.209.786.209 2.423.209 2.423s0 1.637-.21 2.423a1.26 1.26 0 0 1-.883.89c-.782.21-3.907.21-3.907.21s-3.125 0-3.907-.21a1.26 1.26 0 0 1-.884-.89c-.21-.786-.21-2.423-.21-2.423s0-1.637.21-2.423a1.26 1.26 0 0 1 .884-.89c.782-.21 3.907-.21 3.907-.21s3.125 0 3.907.21c.212.058.405.171.56.327M11.6 12l-2.614-1.487v2.974z"
        fill="#fff"
        fillRule="evenodd"
      />
    </g>
    <defs>
      <clipPath id="learning-video_a">
        <path d="M5 7h10v10H5z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
LearningVideo.displayName = 'LearningVideo';
