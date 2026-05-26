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

import { Tooltip } from 'antd';
import classNames from 'classnames';
import {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as RightArrowIcon } from '../../../assets/svg/right-arrow.svg';
import { BREADCRUMB_SEPARATOR } from '../../../constants/constants';
import TitleBreadcrumbSkeleton from '../Skeleton/BreadCrumb/TitleBreadcrumbSkeleton.component';
import './title-breadcrumb.less';
import { TitleBreadcrumbProps, TitleLink } from './TitleBreadcrumb.interface';

const ELLIPSIS_KEY = '__breadcrumb_ellipsis__';

type DisplayLink = TitleLink | { ellipsis: true; collapsed: TitleLink[] };

const TitleBreadcrumb: FunctionComponent<TitleBreadcrumbProps> = ({
  titleLinks,
  className = '',
  noLink = false,
  loading = false,
  widthDeductions,
  useCustomArrow = false,
  maxVisible = 3,
}: TitleBreadcrumbProps) => {
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [isExpanded, setIsExpanded] = useState(false);

  // GitHub-style collapse: when path exceeds maxVisible, render
  // [first, …chip, ...last(maxVisible - 1)]. Clicking the chip expands inline.
  const displayLinks = useMemo<DisplayLink[]>(() => {
    if (isExpanded || titleLinks.length <= maxVisible || maxVisible < 3) {
      return titleLinks;
    }
    const tailCount = maxVisible - 1;
    const collapsed = titleLinks.slice(1, titleLinks.length - tailCount);

    return [
      titleLinks[0],
      { ellipsis: true, collapsed },
      ...titleLinks.slice(-tailCount),
    ];
  }, [titleLinks, maxVisible, isExpanded]);

  const finalWidthOfBreadcrumb = useMemo(() => {
    return (
      screenWidth - (widthDeductions ?? 0) - (displayLinks.length - 1) * 25 - 80
    );
  }, [screenWidth, displayLinks, widthDeductions]);

  const maxWidth = useMemo(() => {
    return finalWidthOfBreadcrumb / displayLinks.length;
  }, [finalWidthOfBreadcrumb, displayLinks.length]);

  const changeWidth = useCallback(() => {
    setScreenWidth(window.innerWidth);
  }, []);

  const renderSeparator = () =>
    useCustomArrow ? (
      <span className="custom-separator">
        <RightArrowIcon />
      </span>
    ) : (
      <span className="text-sm font-regular p-x-xs text-grey-muted">
        {BREADCRUMB_SEPARATOR}
      </span>
    );

  const renderInactiveSeparator = (
    index: number,
    displayLength: number,
    showAlways: boolean
  ) => {
    if (!showAlways || index >= displayLength - 1) {
      return null;
    }

    return useCustomArrow ? (
      <span className="custom-separator">
        <RightArrowIcon />
      </span>
    ) : (
      <span className="text-xss text-grey-muted">{'>'}</span>
    );
  };

  const renderBreadcrumb = (
    index: number,
    link: TitleLink,
    classes: string,
    displayLength: number
  ) => {
    if (link.url) {
      return (
        <Link
          className={classes}
          style={{
            maxWidth,
          }}
          to={link.url}>
          {link.icon}
          {link.name}
        </Link>
      );
    }

    return (
      <>
        <span
          className={classNames(classes, 'inactive-link cursor-text')}
          data-testid="inactive-link"
          style={{
            maxWidth,
          }}>
          {link.icon}
          {link.name}
        </span>
        {renderInactiveSeparator(index, displayLength, noLink)}
      </>
    );
  };

  const renderEllipsisChip = (collapsed: TitleLink[], position: number) => {
    const fullPath = collapsed.map((c) => c.name).join(' / ');

    return (
      <li
        className="d-flex items-center breadcrumb-item"
        data-testid="breadcrumb-ellipsis"
        key={ELLIPSIS_KEY}>
        <Tooltip placement="bottom" title={fullPath}>
          <button
            className="breadcrumb-ellipsis-chip"
            data-testid="breadcrumb-ellipsis-button"
            type="button"
            onClick={() => setIsExpanded(true)}>
            …
          </button>
        </Tooltip>
        {position < displayLinks.length - 1 && renderSeparator()}
      </li>
    );
  };

  useEffect(() => {
    window.addEventListener('resize', changeWidth);

    return () => {
      window.removeEventListener('resize', changeWidth);
    };
  }, []);

  useEffect(() => {
    setIsExpanded(false);
  }, [titleLinks]);

  return (
    <TitleBreadcrumbSkeleton loading={loading}>
      <nav
        className={classNames('breadcrumb-container', className)}
        data-testid="breadcrumb">
        <ol className="rounded-4 text-sm font-regular d-flex flex-wrap">
          {displayLinks.map((entry, index) => {
            if ('ellipsis' in entry) {
              return renderEllipsisChip(entry.collapsed, index);
            }

            const link = entry;
            const classes =
              'link-title truncate' + (link.activeTitle ? ' font-medium' : '');
            const isLast = index === displayLinks.length - 1;

            return (
              <li
                className="d-flex items-center breadcrumb-item"
                data-testid="breadcrumb-link"
                key={link.name}>
                {link.imgSrc ? (
                  <img alt="" className="inline h-5 m-r-xs" src={link.imgSrc} />
                ) : null}
                {!isLast && !noLink && link.url ? (
                  <>
                    <Link
                      className={classes}
                      style={{ maxWidth }}
                      to={link.url}>
                      {link.icon}
                      {link.name}
                    </Link>
                    {renderSeparator()}
                  </>
                ) : (
                  renderBreadcrumb(index, link, classes, displayLinks.length)
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
