ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine as base

WORKDIR /usr/src/app

# RUN apk add --no-cache openssl 

COPY package*.json ./
COPY yarn.lock ./



# Install app dependencies 
RUN yarn install


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