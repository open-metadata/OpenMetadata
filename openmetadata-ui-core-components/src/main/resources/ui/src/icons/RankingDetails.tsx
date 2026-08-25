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

export const RankingDetails: FC<Props> = ({
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
      d="M3.2 14.798c0-1.13 0-1.697.35-2.048.352-.352.918-.352 2.05-.352H6c.753 0 1.13 0 1.365.235.234.234.234.611.234 1.365v4H3.2zm9.198.802c0-.754 0-1.131.235-1.366.234-.234.611-.234 1.365-.234h.4c1.132 0 1.698 0 2.049.351.351.352.351.918.351 2.049V18h-4.4zM2 18h16"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.602 13.2c0-1.13 0-1.696.351-2.048.352-.351.917-.351 2.049-.351 1.13 0 1.697 0 2.048.351.352.352.352.917.352 2.049V18h-4.8zm2.952-10.738.563 1.136c.077.158.281.31.454.338l1.02.171c.654.11.807.588.337 1.059l-.794.8a.7.7 0 0 0-.166.584l.227.99c.18.784-.234 1.087-.921.677l-.957-.57a.69.69 0 0 0-.634 0l-.956.57c-.685.41-1.101.104-.922-.677l.227-.99a.7.7 0 0 0-.166-.584l-.794-.8c-.467-.471-.316-.949.336-1.059l1.021-.17a.7.7 0 0 0 .451-.34l.563-1.135c.308-.616.807-.616 1.11 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
RankingDetails.displayName = 'RankingDetails';
