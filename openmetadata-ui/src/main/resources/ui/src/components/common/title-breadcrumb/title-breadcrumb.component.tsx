/*
 *  Copyright 2022 Collate.
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
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import TitleBreadcrumbSkeleton from '../../Skeleton/BreadCrumb/TitleBreadcrumbSkeleton.component';
import { TitleBreadcrumbProps } from './title-breadcrumb.interface';

const TitleBreadcrumb: FunctionComponent<TitleBreadcrumbProps> = ({
  titleLinks,
  className = '',
  noLink = false,
  loading = false,
  widthDeductions,
}: TitleBreadcrumbProps) => {
  const { t } = useTranslation();
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  const finalWidthOfBreadcrumb = useMemo(() => {
    return (
      screenWidth -
      (widthDeductions ? widthDeductions : 0) - // Any extra deductions due to sibling elements of breadcrumb
      (titleLinks.length - 1) * 25 - // Deduction for every arrow between each titleLink name
      80 // Deduction due to margin of the container on both sides
    );
  }, [screenWidth, titleLinks, widthDeductions]);

  const maxWidth = useMemo(() => {
    return finalWidthOfBreadcrumb / titleLinks.length;
  }, [finalWidthOfBreadcrumb, titleLinks.length]);

  const changeWidth = useCallback(() => {
    setScreenWidth(window.innerWidth);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', changeWidth);

    return () => {
      window.removeEventListener('resize', changeWidth);
    };
  }, []);

  return (
    <TitleBreadcrumbSkeleton loading={loading}>
      <nav className={className} data-testid="breadcrumb">
        <ol className="rounded-4 d-flex flex-wrap">
          {titleLinks.map((link, index) => {
            const classes =
              'link-title tw-truncate' +
              (link.activeTitle ? ' font-medium' : '');

            return (
              <li
                className="d-flex items-center breadcrumb-item"
                data-testid="breadcrumb-link"
                key={index}>
                {link.imgSrc ? (
                  <img
                    alt=""
                    className="inline tw-h-5 tw-mr-2"
                    src={link.imgSrc}
                  />
                ) : null}
                {index < titleLinks.length - 1 && !noLink ? (
                  <>
                    <Link
                      className={classes}
                      style={{
                        maxWidth,
                        fontSize: '16px',
                      }}
                      to={link.url}>
                      {link.name}
                    </Link>
                    <span className="text-xss p-x-xs text-grey-muted">
                      {t('label.slash-symbol')}
                    </span>
                  </>
                ) : link.url ? (
                  <Link
                    className={classes}
                    style={{
                      maxWidth,
                    }}
                    to={link.url}>
                    {link.name}
                  </Link>
                ) : (
                  <>
                    <span
                      className={classNames(
                        classes,
                        'inactive-link tw-cursor-text hover:tw-text-primary hover:tw-no-underline'
                      )}
                      data-testid="inactive-link"
                      style={{
                        maxWidth,
                      }}>
                      {link.name}
                    </span>
                    {noLink && index < titleLinks.length - 1 && (
                      <span className="text-xss tw-px-2 text-grey-muted">
                        {t('label.slash-symbol')}
                      </span>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </TitleBreadcrumbSkeleton>
  );
};

export default TitleBreadcrumb;
