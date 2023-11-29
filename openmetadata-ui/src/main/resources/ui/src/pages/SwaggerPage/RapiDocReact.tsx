/*
 *  Copyright 2023 Collate.
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
/* eslint-disable @typescript-eslint/no-explicit-any */
import 'rapidoc';
import React from 'react';

interface RapiDocProps
  extends React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  > {
  // General
  'spec-url': string;
  'update-route'?: boolean;
  'route-prefix'?: string;
  'sort-tags'?: boolean;
  'sort-endpoints-by'?: 'path' | 'method' | 'summary' | 'none';
  'heading-text'?: string;
  'goto-path'?: string;
  'fill-request-fields-with-example'?: boolean;
  'persist-auth'?: boolean;
  // UI Colors and Fonts
  theme?: 'light' | 'dark';
  'bg-color'?: string;
  'text-color'?: string;
  'header-color'?: string;
  'primary-color'?: string;
  'load-fonts'?: boolean;
  'regular-font'?: string;
  'mono-font'?: string;
  'font-size'?: 'default' | 'large' | 'largest';
  // Navigation
  'show-method-in-nav-bar'?:
    | 'false'
    | 'as-plain-text'
    | 'as-colored-text'
    | 'as-colored-block';
  'use-path-in-nav-bar'?: boolean;
  'nav-bg-color'?: string;
  'nav-text-color'?: string;
  'nav-hover-bg-color'?: string;
  'nav-hover-text-color'?: string;
  'nav-accent-color'?: string;
  'nav-item-spacing'?: 'default' | 'compact' | 'relaxed';
  // UI Layout & Placement
  layout?: 'row' | 'column';
  'render-style'?: 'read' | 'view' | 'focused';
  'on-nav-tag-click'?: 'expand-collapse' | 'show-description';
  'schema-style'?: 'tree' | 'table';
  'schema-expand-level'?: number;
  'schema-description-expanded'?: boolean;
  'schema-hide-read-only'?: 'always' | 'never' | string;
  'default-schema-tab'?: 'model' | 'example';
  'response-area-height'?: string;
  // Hide/Show Sections
  'show-info'?: boolean;
  'info-description-headings-in-navbar'?: boolean;
  'show-components'?: boolean;
  'show-header'?: boolean;
  'allow-authentication'?: boolean;
  'allow-spec-url-load'?: boolean;
  'allow-spec-file-load'?: boolean;
  'allow-spec-file-download'?: boolean;
  'allow-search'?: boolean;
  'allow-advanced-search'?: boolean;
  'allow-try'?: boolean;
  'allow-server-selection'?: boolean;
  'allow-schema-description-expand-toggle'?: boolean;
  // API Server & calls
  'server-url'?: string;
  'default-api-server'?: string;
  'api-key-name'?: string;
  'api-key-location'?: 'header' | 'query';
  'api-key-value'?: string | null;
  'fetch-credentials'?: 'omit' | 'same-origin' | 'include';
  // Events
  beforeRender?: (spec: any) => void;
  specLoaded?: (spec: any) => void;
  beforeTry?: (request: any) => any;
  afterTry?: (data: any) => any;
  apiServerChange?: (server: any) => any;
}

declare global {
  interface HTMLElementTagNameMap {
    'rapi-doc': HTMLDivElement;
  }
  /* eslint-disable @typescript-eslint/no-namespace */
  namespace JSX {
    interface IntrinsicElements {
      'rapi-doc': RapiDocProps;
    }
  }
}

export const RapiDocReact = React.forwardRef<HTMLDivElement, RapiDocProps>(
  (
    {
      beforeRender,
      specLoaded,
      beforeTry,
      afterTry,
      apiServerChange,
      children,
      ...props
    }: RapiDocProps,
    ref
  ) => {
    const localRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      const rapiDocRef =
        typeof ref === 'object' && ref?.current
          ? ref?.current
          : localRef.current;

      const handleBeforeRender = (spec: any) => {
        beforeRender && beforeRender(spec);
      };

      const handleSpecLoaded = (spec: any) => {
        specLoaded && specLoaded(spec);
      };

      const handleBeforeTry = (request: any) => {
        beforeTry && beforeTry(request);
      };

      const handleAfterTry = (data: any) => {
        afterTry && afterTry(data);
      };

      const handleApiServerChange = (server: any) => {
        apiServerChange && apiServerChange(server);
      };

      if (rapiDocRef) {
        beforeRender &&
          rapiDocRef.addEventListener('before-render', handleBeforeRender);
        specLoaded &&
          rapiDocRef.addEventListener('spec-loaded', handleSpecLoaded);
        beforeTry && rapiDocRef.addEventListener('before-try', handleBeforeTry);
        afterTry && rapiDocRef.addEventListener('after-try', handleAfterTry);
        apiServerChange &&
          rapiDocRef.addEventListener(
            'api-server-change',
            handleApiServerChange
          );
      }

      return () => {
        if (rapiDocRef) {
          beforeRender &&
            rapiDocRef.removeEventListener('before-render', handleBeforeRender);
          specLoaded &&
            rapiDocRef.removeEventListener('spec-loaded', handleSpecLoaded);
          beforeTry &&
            rapiDocRef.removeEventListener('before-try', handleBeforeTry);
          afterTry &&
            rapiDocRef.removeEventListener('after-try', handleAfterTry);
          apiServerChange &&
            rapiDocRef.removeEventListener(
              'api-server-change',
              handleApiServerChange
            );
        }
      };
    }, [
      ref,
      localRef,
      specLoaded,
      beforeRender,
      beforeTry,
      afterTry,
      apiServerChange,
    ]);

    return (
      <rapi-doc {...props} ref={ref || localRef}>
        {children}
      </rapi-doc>
    );
  }
);

export default RapiDocReact;
