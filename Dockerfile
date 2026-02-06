ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine as base

WORKDIR /usr/src/app

# Install dependencies required for sharp (image processing) on Alpine Linux
RUN apk add --no-cache \
    vips-dev \
    vips-tools \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

COPY package*.json ./
# Copy yarn.lock if it exists (will fail silently if missing)
COPY yarn.lock ./

# Install app dependencies
# Try frozen lockfile first, but fallback to generating new one if it fails
# This handles cases where yarn.lock might be corrupted (e.g., @types/connect@*)
RUN yarn install --frozen-lockfile || yarn install

# Rebuild sharp for Alpine Linux (musl ARM64)
# Use environment variables for cross-platform installation (per sharp docs)
# Prebuilt binaries are available for Linux ARM64 musl >= 1.2.2
# See: https://sharp.pixelplumbing.com/install/#cross-platform
RUN rm -rf node_modules/sharp && \
    npm_config_platform=linux \
    npm_config_arch=arm64 \
    npm_config_libc=musl \
    yarn add sharp --force

RUN yarn add @css-inline/css-inline-linux-arm64-musl --force


###################
# BUILD FOR LOCAL DEVELOPMENT
###################

FROM base As development

COPY . .



###################
# BUILD FOR PRODUCTION
###################

FROM base As build

COPY --chown=node:node . .

# Run the build command which creates the production bundle
RUN yarn run build


USER node



###################
# PRODUCTION
###################

FROM build As production

# Copy the bundled code from the build stage to the production image
COPY --chown=node:node --from=base /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/dist ./dist

CMD npx prisma migrate deploy ; yarn run start:dev