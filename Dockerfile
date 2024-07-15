FROM golang:1.21-alpine AS builder
ENV CGO_ENABLED=0
WORKDIR /backend
COPY backend/go.* .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download
COPY backend/. .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -ldflags="-s -w" -o bin/service

FROM --platform=$BUILDPLATFORM node:21.6-alpine3.18 AS client-builder
WORKDIR /ui
# cache packages in layer
COPY ui/package.json /ui/package.json
COPY ui/package-lock.json /ui/package-lock.json
RUN --mount=type=cache,target=/usr/src/app/.npm \
    npm set cache /usr/src/app/.npm && \
    npm ci
# install mui icons
RUN npm install @mui/icons-material

COPY ui /ui
RUN npm run build

FROM alpine
LABEL org.opencontainers.image.title="Copacetic" \
    org.opencontainers.image.description="Directly patch container images given the vulnerability scanning results from popular tools like Trivy." \
    org.opencontainers.image.vendor="Microsoft" \
    com.docker.desktop.extension.api.version="0.3.4" \
    com.docker.extension.screenshots="\
    [ \
    {\"alt\": \"Copa Light Screenshot\", \"url\": \"https://raw.githubusercontent.com/jgrer/copa-extension/dockerfile-label-documentation/.github/images/demo1.png\"}, \
    {\"alt\": \"Copa Dark Screenshot\", \"url\": \"https://raw.githubusercontent.com/jgrer/copa-extension/dockerfile-label-documentation/.github/images/demo2.png\"}, \
    {\"alt\": \"Copa Settings\", \"url\": \"https://raw.githubusercontent.com/jgrer/copa-extension/dockerfile-label-documentation/.github/images/demo3.png\"}, \
    {\"alt\": \"Copa Scan For Vulnerability\", \"url\": \"https://raw.githubusercontent.com/jgrer/copa-extension/dockerfile-label-documentation/.github/images/demo4.png\"}, \
    {\"alt\": \"Copa Vulnerability Display\", \"url\": \"https://raw.githubusercontent.com/jgrer/copa-extension/dockerfile-label-documentation/.github/images/demo5.png\"}, \
    {\"alt\": \"Copa Patching Image Show Console\", \"url\": \"https://raw.githubusercontent.com/jgrer/copa-extension/dockerfile-label-documentation/.github/images/demo6.png\"}, \
    {\"alt\": \"Copa Success Screen And Patched Image Vuln Display\", \"url\": \"https://raw.githubusercontent.com/jgrer/copa-extension/dockerfile-label-documentation/.github/images/demo7.png\"} \
    ]" \
    com.docker.desktop.extension.icon="https://raw.githubusercontent.com/project-copacetic/copacetic/main/images/copa-color.png" \
    com.docker.extension.detailed-description="<h1>Copacetic Extension For Docker Desktop</h1> \
    The copa tool is a versatile engine designed to parse container image vulnerability reports from scanners like Trivy, \
    process update packages through various package managers, and apply updates to container images using buildkit, with \
    the flexibility to extend support for additional report formats and package managers." \
    com.docker.extension.publisher-url="https://project-copacetic.github.io/copacetic/website/" \
    com.docker.extension.additional-urls='\
    [ \ 
    {"title":"Documentation","url":"https://project-copacetic.github.io/copacetic/website/"}, \
    {"title":"Extension Repository","url":"https://github.com/project-copacetic/copa-extension"} \
    ]' \
    com.docker.extension.categories="security" \
    com.docker.extension.changelog="Initial version."

COPY --from=builder /backend/bin/service /
COPY docker-compose.yaml .
COPY metadata.json .
COPY copa-color.svg .
COPY --from=client-builder /ui/build ui
CMD /service -socket /run/guest-services/backend.sock
