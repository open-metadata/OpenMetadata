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

export const ApiEndpoint: FC<Props> = ({
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
      d="M5.6 15.598a3.6 3.6 0 0 1-.703-7.13c.146-.03.22-.044.264-.07a.26.26 0 0 0 .097-.094c.029-.043.046-.113.08-.253a4.802 4.802 0 0 1 9.324 0c.034.14.051.21.08.253a.26.26 0 0 0 .097.093c.045.027.118.041.264.07a3.601 3.601 0 0 1-.703 7.131z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.451 13.38V9.508h.83v3.872z"
      fill="currentColor"
      stroke="none"
    />
    <path
      d="M14.35 9.441v4.011h-.967v-4.01zm-.83 3.872h.692V9.579h-.691zM10 13.38V9.508h1.505q.476 0 .785.16.315.16.47.443.155.277.155.625 0 .325-.149.603-.15.276-.46.448-.309.172-.801.172h-.675v1.421zm.83-2.085h.62q.326 0 .47-.15.15-.155.149-.41 0-.259-.15-.403-.143-.15-.47-.15h-.62z"
      fill="currentColor"
      stroke="none"
    />
    <path
      d="M12.845 10.74q0-.333-.147-.592v-.002a1 1 0 0 0-.301-.331l-.14-.083q-.29-.151-.753-.153h-1.436v3.734h.691v-1.42h.745c.32 0 .575-.058.768-.165q.294-.162.432-.42a1.2 1.2 0 0 0 .14-.569m-.846 0c0-.16-.046-.276-.129-.355l-.001-.002c-.077-.08-.212-.128-.421-.128h-.55v.973h.55c.21 0 .344-.048.42-.128a.5.5 0 0 0 .13-.36m.138 0q.001.276-.17.457c-.114.118-.293.17-.519.17h-.689v-1.25h.689c.224 0 .402.05.517.167h.001c.117.113.17.268.17.455m.847 0q0 .342-.158.634-.162.296-.488.476-.332.182-.834.18h-.607v1.422H9.93V9.44h1.574q.487-.001.817.167l.155.092q.22.152.344.38.164.293.164.658M5.748 13.38l1.41-3.872h.952l1.41 3.872h-.879L7.63 10.443 6.617 13.38zm.614-.846.221-.642h2.03l.216.642z"
      fill="currentColor"
      stroke="none"
    />
    <path
      d="m8.157 9.441.018.045 1.41 3.873.034.093H8.592l-.017-.047-.276-.8H6.957l-.276.8-.016.047H5.648l.034-.093 1.41-3.873.018-.045zm-2.311 3.872h.72l.245-.708h-.547l.031-.092.222-.641.016-.046h.546l.484-1.404.065-.189.065.19.483 1.403h.486l.016.047.217.642.03.09h-.48l.244.708h.732L8.06 9.579h-.853zm2.552-.846h.334l-.169-.503h-.34zm-1.394 0h1.248l-.173-.503h-.901zm-.545 0h.4l.172-.503h-.399zm.766-.641h.806l-.403-1.17z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);
ApiEndpoint.displayName = 'ApiEndpoint';
