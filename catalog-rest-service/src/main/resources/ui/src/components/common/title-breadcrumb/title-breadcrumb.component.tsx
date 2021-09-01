/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import classNames from 'classnames';
import React, { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import { TitleBreadcrumbProps } from './title-breadcrumb.interface';

const TitleBreadcrumb: FunctionComponent<TitleBreadcrumbProps> = ({
  titleLinks,
  className = '',
}: TitleBreadcrumbProps) => {
  return (
    <nav className={className}>
      <ol className="list-reset tw-py-2 tw-rounded tw-flex">
        {titleLinks.map((link, index) => {
          const classes =
            'link-title' + (link.activeTitle ? ' tw-font-normal' : '');

          return (
            <li key={index}>
              {link.imgSrc ? (
                <img
                  alt=""
                  className="tw-inline tw-h-5 tw-w-5 tw-mr-2"
                  src={link.imgSrc}
                />
              ) : null}
              {index < titleLinks.length - 1 ? (
                <>
                  <Link className={classes} to={link.url}>
                    {link.name}
                  </Link>
                  <span className="tw-px-2">
                    <i className="fas fa-angle-double-right tw-text-xs tw-cursor-default tw-text-gray-400 tw-align-middle" />
                  </span>
                </>
              ) : link.url ? (
                <Link className={classes} to={link.url}>
                  {link.name}
                </Link>
              ) : (
                <span
                  className={classNames(
                    classes,
                    'tw-cursor-text hover:tw-text-primary hover:tw-no-underline'
                  )}>
                  {link.name}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default TitleBreadcrumb;
