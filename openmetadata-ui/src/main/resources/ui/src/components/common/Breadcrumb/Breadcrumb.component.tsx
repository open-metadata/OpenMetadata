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

import classNames from 'classnames';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as HomeIcon } from '../../../assets/svg/ic-home.svg';
import { ROUTES } from '../../../constants/constants';
import { BreadcrumbProps } from './Breadcrumb.interface';

import './breadcrumb.less';

export function Breadcrumb({
  titleLinks,
  showHomeIcon = true,
  className,
  separator = '>',
  'data-testid': dataTestId = 'breadcrumb',
}: BreadcrumbProps) {
  return (
    <nav
      className={classNames('breadcrumb-navigation', className)}
      data-testid={dataTestId}>
      <div className="breadcrumb-items">
        {showHomeIcon && (
          <>
            <Link
              className="breadcrumb-home-icon"
              data-testid="breadcrumb-home"
              to={ROUTES.MY_DATA}>
              <HomeIcon className="breadcrumb-icon" />
            </Link>
            {titleLinks.length > 0 && (
              <span
                className="breadcrumb-separator"
                data-testid="breadcrumb-separator">
                {separator}
              </span>
            )}
          </>
        )}

        {titleLinks.map((link, index) => {
          const isLastItem = index === titleLinks.length - 1;

          return (
            <Fragment key={`${link.name}-${index}`}>
              {link.imgSrc && (
                <img alt="" className="breadcrumb-item-img" src={link.imgSrc} />
              )}

              {!isLastItem || !link.activeTitle ? (
                <Link className="breadcrumb-link" to={link.url}>
                  {link.name}
                </Link>
              ) : (
                <span
                  className={classNames('breadcrumb-text', {
                    'breadcrumb-text-current': link.activeTitle,
                  })}>
                  {link.name}
                </span>
              )}

              {!isLastItem && (
                <span
                  className="breadcrumb-separator"
                  data-testid="breadcrumb-separator">
                  {separator}
                </span>
              )}
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}
