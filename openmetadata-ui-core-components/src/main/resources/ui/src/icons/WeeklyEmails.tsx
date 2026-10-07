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

export const WeeklyEmails: FC<Props> = ({
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
      d="M12.614 2v3.2M6.214 2v3.2M16.616 10c0-3.016 0-4.524-.937-5.461s-2.445-.937-5.462-.937h-1.6c-3.016 0-4.524 0-5.461.937S2.219 6.984 2.219 10v1.6c0 3.016 0 4.525.937 5.462s2.445.937 5.461.937M2.219 8.402h14.397"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m11.152 12.828 2.074 1.175c.764.433 1.087.433 1.851 0l2.074-1.175"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.525 15.225c.024 1.113.036 1.67.447 2.082.41.413.982.427 2.126.456.705.018 1.403.018 2.107 0 1.144-.029 1.716-.043 2.127-.456.41-.412.422-.969.446-2.082q.012-.536 0-1.072c-.024-1.114-.036-1.67-.446-2.083-.411-.412-.983-.426-2.127-.455a42 42 0 0 0-2.107 0c-1.144.029-1.716.043-2.126.455-.411.413-.423.97-.447 2.083q-.01.536 0 1.072"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
WeeklyEmails.displayName = 'WeeklyEmails';
