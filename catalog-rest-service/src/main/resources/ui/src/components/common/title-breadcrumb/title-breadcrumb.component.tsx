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
              {index < titleLinks.length - 1 ? (
                <>
                  {link.imgSrc ? (
                    <img
                      alt=""
                      className="tw-inline tw-h-5 tw-w-5 tw-mr-2"
                      src={link.imgSrc}
                    />
                  ) : null}
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
                <span className={classNames(classes, 'tw-cursor-text')}>
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
