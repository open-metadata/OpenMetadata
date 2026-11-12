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

export const AutomationsFilled: FC<Props> = ({
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
      d="M17.95 10.839a7.994 7.994 0 0 1-14.873 3.157l-.235-.407m-.792-4.43a7.994 7.994 0 0 1 14.873-3.157l.235.407M2 15.704l.637-2.376a.2.2 0 0 1 .245-.142l2.376.637m9.484-7.648 2.376.637a.2.2 0 0 0 .245-.142L18 4.294"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.228 5.328c.124 0 .272 0 .4.014.109.012.24.04.371.105l.133.08.117.101c.104.105.171.22.217.318.055.117.1.259.14.377h-.001l.127.376q.017.044.055.07l.085.05q.048.022.1.012l.463-.13.206-.056q.106-.03.21-.046c.114-.019.256-.028.41.006l.157.048.147.076c.133.083.227.188.297.28.082.11.16.249.227.365l.198.344c.063.109.138.238.19.357.058.135.113.315.09.531a1.04 1.04 0 0 1-.199.501c-.075.106-.175.215-.26.308l.002.001-.388.434-.016.04a.4.4 0 0 0-.018.109.4.4 0 0 0 .034.148l.387.434.133.15q.069.08.126.16c.064.09.132.204.171.347l.029.154.004.155a1.1 1.1 0 0 1-.095.376c-.052.12-.127.248-.19.357l-.198.344c-.067.117-.145.255-.227.364-.093.124-.23.27-.444.357a1.04 1.04 0 0 1-.567.054c-.135-.021-.287-.065-.416-.102v-.001l-.463-.13a.15.15 0 0 0-.098.013l-.088.05a.16.16 0 0 0-.053.068l-.128.377c-.039.12-.085.26-.139.378a1.04 1.04 0 0 1-.334.419 1.04 1.04 0 0 1-.504.185c-.128.015-.276.014-.4.014H9.78c-.125 0-.274 0-.402-.014a1.04 1.04 0 0 1-.503-.185 1.05 1.05 0 0 1-.335-.42c-.054-.116-.1-.258-.14-.376v-.001l-.126-.377a.15.15 0 0 0-.056-.069l-.084-.048-.05-.016a.2.2 0 0 0-.051.002l-.462.13c-.128.038-.28.082-.415.103a1.04 1.04 0 0 1-.568-.054 1.04 1.04 0 0 1-.443-.357c-.082-.11-.16-.248-.228-.364l-.198-.344c-.063-.109-.138-.238-.19-.357a1.04 1.04 0 0 1-.09-.531l.028-.154c.04-.143.107-.258.171-.347.075-.106.176-.216.26-.31l.386-.434.016-.04A.4.4 0 0 0 6.32 10a.4.4 0 0 0-.035-.15l-.387-.433c-.083-.094-.184-.203-.259-.309a1.04 1.04 0 0 1-.2-.5 1.04 1.04 0 0 1 .092-.532c.051-.12.126-.248.19-.357l.197-.344c.067-.116.146-.254.228-.364.092-.124.23-.27.444-.357l.157-.048c.154-.034.295-.024.41-.006.135.021.287.066.416.102l.46.13q.053.011.102-.013l.084-.05a.15.15 0 0 0 .056-.069l.127-.376.064-.188q.035-.099.075-.189c.062-.132.16-.292.335-.419.176-.126.358-.169.503-.185.128-.015.277-.014.402-.014zm-.223 3.421a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5"
      fill="currentColor"
    />
  </svg>
);
AutomationsFilled.displayName = 'AutomationsFilled';
