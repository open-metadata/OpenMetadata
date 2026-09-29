#  Copyright 2024 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

# ── Stage 1: build Storybook static assets ──────────────────────────────────
# Build context must be the repo root so both the source tree and this config
# file are reachable.  The nightly workflow calls:
#   docker build -f docker/storybook/Dockerfile .
FROM node:22.17-alpine AS builder

WORKDIR /app

# Copy lockfile + manifest first so the layer is cached when only source changes.
COPY openmetadata-ui-core-components/src/main/resources/ui/package.json \
     openmetadata-ui-core-components/src/main/resources/ui/yarn.lock ./

# Install all dependencies (dev deps are required for the Storybook build).
RUN yarn install --frozen-lockfile --network-timeout 120000

# Copy the rest of the source tree.
COPY openmetadata-ui-core-components/src/main/resources/ui/ ./

# Produce the static site in storybook-static/.
RUN yarn build-storybook

# ── Stage 2: serve with Node ─────────────────────────────────────────────────
FROM node:22.17-alpine AS server

# `serve` is the static file server Storybook recommends; pin the major so the
# CLI flags stay stable across nightly rebuilds.
RUN npm install -g serve@14

COPY --from=builder /app/storybook-static /app/storybook-static

# Storybook 8's manager requests the preview at /iframe (no .html extension).
# serve's --single SPA fallback would intercept that path (no matching file on
# disk) and return index.html — the manager shell — into the preview iframe,
# so components never render.  This rewrite rule maps /iframe → /iframe.html
# before the fallback runs, giving the preview iframe the correct content.
RUN printf '{"rewrites":[{"source":"/iframe","destination":"/iframe.html"}]}' \
    > /app/serve.json

# Drop to the built-in unprivileged user — running a public server as root is unnecessary.
USER node

EXPOSE 6006

CMD ["serve", "/app/storybook-static", "-l", "6006", "-c", "/app/serve.json"]
