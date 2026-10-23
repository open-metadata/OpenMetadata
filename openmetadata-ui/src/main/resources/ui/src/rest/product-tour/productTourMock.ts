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
import {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { TOUR_WRITE_METHODS } from '../../constants/product-tour/productTour.constants';
import { ProductTourFixture } from '../../interface/product-tour/productTour.interface';
import {
  buildTourFixtureIndex,
  findTourFixture,
  isTourPassThroughPath,
  toTourRequest,
  TourFixtureIndex,
} from '../../utils/product-tour/productTourMock.utils';
import { getApiBaseUrl } from '../apiBaseUrl';

type LoadFixtures = () => Promise<ProductTourFixture[]>;

let activeLoader: LoadFixtures | undefined;
let fixtureIndex: Promise<TourFixtureIndex> | undefined;
let requestsInFlight = 0;

// Fixtures that fail to load (a stale tab after a redeploy) leave every
// request to the server rather than failing them all.
const loadIndex = (loadFixtures: LoadFixtures) =>
  loadFixtures()
    .then(buildTourFixtureIndex)
    .catch(() => buildTourFixtureIndex([]));
let lastRequestSettledAt = 0;

const WRITE_METHODS = new Set<string>(TOUR_WRITE_METHODS);

const respondWith = (
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown
) => {
  config.adapter = async (): Promise<AxiosResponse> => ({
    data: structuredClone(data),
    status,
    statusText: 'OK',
    headers: {},
    config,
    request: {},
  });
};

/**
 * Serves the tour's pages from its fixtures. Set by the tour store when a tour
 * starts or resumes after a reload, and cleared when it ends.
 */
export const activateTourMock = (loadFixtures: LoadFixtures) => {
  if (activeLoader !== loadFixtures) {
    activeLoader = loadFixtures;
    // Loaded now, so the first page's requests do not wait on it.
    fixtureIndex = loadIndex(loadFixtures);
  }
};

export const deactivateTourMock = () => {
  activeLoader = undefined;
  fixtureIndex = undefined;
  requestsInFlight = 0;
};

export const isTourMockActive = () => activeLoader !== undefined;

/**
 * Whether the tour's page has made no request for `quietMs`: none in flight,
 * and none answered within that window, so a panel that fetches right after
 * the page's first data has started before a step opens over it.
 */
export const isTourPageQuiet = (quietMs: number) =>
  requestsInFlight === 0 && performance.now() - lastRequestSettledAt >= quietMs;

const settleRequest = () => {
  requestsInFlight = Math.max(0, requestsInFlight - 1);
  lastRequestSettledAt = performance.now();
};

/**
 * While a tour runs, a request with a recorded fixture is answered from it and
 * never reaches the server, and an update or delete is dropped: the tour shows
 * the same pages on every instance and changes nothing. Anything else, the
 * signed-in user and their permissions, goes to the server as usual.
 * ADR:2026-10-23-the-product-tour-serves-its-pages-from-recorded-fixtures
 */
export const attachTourMockInterceptor = (client: AxiosInstance) => {
  client.interceptors.request.use(async (config) => {
    const loadFixtures = activeLoader;
    if (!loadFixtures) {
      return config;
    }
    requestsInFlight += 1;
    const method = (config.method ?? 'get').toLowerCase();
    // The URL axios is about to send, params serialised as it will send
    // them, after the other request interceptors have run.
    const request = toTourRequest(
      method,
      client.getUri(config),
      new URL(getApiBaseUrl(), window.location.origin).pathname,
      config.data
    );
    // Who is signed in, their permissions, auth and app setup: never a
    // fixture, even if one was recorded by mistake.
    if (isTourPassThroughPath(request.path)) {
      return config;
    }
    fixtureIndex ??= loadIndex(loadFixtures);
    const fixture = findTourFixture(await fixtureIndex, request);

    if (fixture) {
      respondWith(config, fixture.status ?? 200, fixture.data);
    } else if (WRITE_METHODS.has(method)) {
      respondWith(config, 200, {});
    }

    return config;
  });
  client.interceptors.response.use(
    (response) => {
      if (activeLoader) {
        settleRequest();
      }

      return response;
    },
    (error) => {
      if (activeLoader) {
        settleRequest();
      }

      return Promise.reject(error);
    }
  );
};
