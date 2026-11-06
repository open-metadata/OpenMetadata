/*
 *  Copyright 2026 Collate.
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

import { Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';

/**
 * AI-mode observability pages live under `/observability/*`; the same pages
 * sit at the root in Classic mode. Strips the prefix so a shared AI-mode link
 * opens the Classic page instead of a 404.
 */
const ClassicObservabilityRedirect = () => {
  const { pathname, search, hash } = useLocation();
  const classicPath = pathname.replace(/^\/observability/, '');
  // `/observability` and `/observability/` have no Classic page of their own.
  const target =
    classicPath === '' || classicPath === '/'
      ? ROUTES.DATA_QUALITY
      : classicPath;

  return <Navigate replace to={`${target}${search}${hash}`} />;
};

export default ClassicObservabilityRedirect;
