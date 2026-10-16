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

export const StringType: FC<Props> = ({
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
      d="M2 10c0-3.771 0-4.657 1.172-5.828S6.229 3 10 3s5.657 0 6.828 1.172S18 6.229 18 10c0 2.771 0 4.657-1.172 5.829S13.771 17 10 17s-5.657 0-6.828-1.171S2 12.77 2 10"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.707 7.617q.376 0 .64.084.27.085.45.22.183.134.294.303.11.174.172.346.057.176.074.337.02.162.02.28a.48.48 0 0 1-.098.296q-.098.129-.44.128-.113 0-.254-.023a.6.6 0 0 1-.239-.095q-.1-.074-.1-.218 0-.36-.102-.57-.097-.212-.418-.212a.4.4 0 0 0-.255.07.44.44 0 0 0-.129.149.5.5 0 0 0-.053.219v2.136q.003.138.053.259.04.098.129.178.09.081.255.081.31 0 .415-.235.104-.24.104-.566 0-.145.128-.226.132-.084.465-.084.303 0 .421.104t.118.233q0 .37-.124.663-.122.29-.35.492-.466.414-1.237.414-.057 0-.196-.01a1.8 1.8 0 0 1-.653-.185 1.1 1.1 0 0 1-.323-.246 1.4 1.4 0 0 1-.243-.39 1.5 1.5 0 0 1-.094-.57v-1.88q0-.276.067-.488.067-.216.179-.37.108-.16.249-.263.14-.105.29-.176.34-.158.784-.185m-4.674.028h.976q.3 0 .566.077.267.078.462.232.198.156.31.388.11.23.11.535a.95.95 0 0 1-.15.523 1 1 0 0 1-.142.181 2 2 0 0 1-.199.162.7.7 0 0 1-.168.098q.195.054.34.145.138.09.229.198a.93.93 0 0 1 .24.52q.02.144.02.255 0 .263-.065.462a1.3 1.3 0 0 1-.168.347q-.105.145-.24.249-.134.105-.272.168a1.9 1.9 0 0 1-.745.176H9.032q-.243 0-.35-.102a.46.46 0 0 1-.136-.276 3 3 0 0 1-.026-.397V8.413q0-.22.026-.391a.46.46 0 0 1 .135-.276q.108-.102.35-.101m.916.795h-.404v1.145h.43a.6.6 0 0 0 .26-.068.45.45 0 0 0 .185-.171.56.56 0 0 0 .074-.3q0-.209-.077-.334a.6.6 0 0 0-.195-.195.8.8 0 0 0-.273-.077m.06 1.859h-.464v1.267h.491a.6.6 0 0 0 .283-.075.5.5 0 0 0 .203-.192.65.65 0 0 0 .08-.34.7.7 0 0 0-.084-.36.6.6 0 0 0-.212-.216.8.8 0 0 0-.297-.084m-2.87-2.021.701 2.378.007.232q.007.12.01.236.01.236.01.462v.1q0 .193-.027.344a.4.4 0 0 1-.121.243q-.098.087-.317.088-.22 0-.32-.088a.4.4 0 0 1-.128-.243 2 2 0 0 1-.024-.343v-.472H5.581v.472q0 .192-.027.343a.4.4 0 0 1-.125.243q-.097.087-.32.088-.222 0-.32-.088a.4.4 0 0 1-.12-.243 2 2 0 0 1-.024-.343v-.101q0-.118.003-.29l.007-.347.01-.293a85 85 0 0 1 .353-1.19 36 36 0 0 0 .354-1.188q.078-.28.22-.455.143-.178.494-.178h.337q.36 0 .495.178.135.175.22.455m-.842.242h-.074l-.499 1.806h1.072z"
      fill="currentColor"
    />
  </svg>
);
StringType.displayName = 'StringType';
