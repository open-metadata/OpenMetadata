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
import { lazy, ReactNode } from 'react';
import loginClassBase from '../../../constants/LoginClassBase';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import DocumentTitle from '../../common/DocumentTitle/DocumentTitle';

const LoginCarousel = withSuspenseFallback(
  lazy(() => import('../../../pages/LoginPage/LoginCarousel'))
);

const LOGIN_SPLIT_LAYOUT_CLASSES =
  'tw:flex tw:h-screen tw:min-h-screen tw:w-full tw:overflow-hidden tw:bg-primary';

const LOGIN_VIDEO_PANEL_CLASSES =
  'tw:relative tw:flex tw:flex-[1_1_52%] tw:min-w-0 tw:items-center ' +
  'tw:justify-center tw:overflow-hidden tw:max-[1000px]:hidden';

const LOGIN_VIDEO_INSET_CLASSES =
  'tw:flex tw:box-border tw:h-full tw:w-full tw:items-center tw:justify-center ' +
  'tw:p-[clamp(16px,2.8vw,48px)] tw:[container-type:size]';

const LOGIN_VIDEO_CARD_CLASSES =
  'tw:relative tw:aspect-[2024/2160] tw:max-h-full tw:max-w-full ' +
  'tw:w-[min(100cqw,93.7cqh)] tw:overflow-hidden tw:rounded-[max(22px,4.8%)] ' +
  'tw:[transform:translateZ(0)]';

const LOGIN_FORM_PANEL_CLASSES =
  'tw:flex tw:flex-[1_1_48%] tw:min-w-0 tw:flex-col tw:overflow-y-auto ' +
  'tw:bg-primary tw:max-[1000px]:flex-[1_1_100%]';

const DEFAULT_SPLIT_LAYOUT_CLASSES =
  'tw:flex tw:h-screen tw:min-h-screen tw:w-full tw:overflow-hidden tw:bg-primary';

const DEFAULT_FORM_COLUMN_CLASSES =
  'tw:flex tw:flex-col tw:overflow-y-auto tw:bg-primary ' +
  'tw:flex-[1_1_100%] tw:xl:flex-[1_1_41%]';

const DEFAULT_MEDIA_COLUMN_CLASSES =
  'tw:hidden tw:xl:flex tw:flex-[1_1_59%] tw:items-center tw:justify-center tw:p-6';

export const CarouselLayout = ({
  pageTitle,
  children,
  carouselClassName,
}: {
  pageTitle: string;
  children: ReactNode;
  carouselClassName?: string;
}) => {
  const hasLoginVideo = Boolean(loginClassBase.getLoginVideo());

  if (hasLoginVideo) {
    return (
      <>
        <DocumentTitle title={pageTitle} />
        <div
          className={classNames(LOGIN_SPLIT_LAYOUT_CLASSES, carouselClassName)}
          data-testid="signin-page">
          <div
            className={classNames(
              LOGIN_VIDEO_PANEL_CLASSES,
              loginClassBase.getLoginVideoPanelClassName()
            )}>
            <div className={LOGIN_VIDEO_INSET_CLASSES}>
              <div
                className={classNames(
                  LOGIN_VIDEO_CARD_CLASSES,
                  loginClassBase.getLoginVideoCardClassName()
                )}>
                <LoginCarousel />
              </div>
            </div>
          </div>
          <div className={LOGIN_FORM_PANEL_CLASSES}>{children}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <DocumentTitle title={pageTitle} />
      <div
        className={DEFAULT_SPLIT_LAYOUT_CLASSES}
        data-testid="signin-page">
        <div className={DEFAULT_FORM_COLUMN_CLASSES}>{children}</div>
        <div
          className={classNames(
            DEFAULT_MEDIA_COLUMN_CLASSES,
            carouselClassName
          )}>
          <LoginCarousel />
        </div>
      </div>
    </>
  );
};
