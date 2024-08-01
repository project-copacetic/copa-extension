FROM golang:1.22-alpine@sha256:0d3653dd6f35159ec6e3d10263a42372f6f194c3dea0b35235d72aabde86486e AS builder
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

FROM --platform=$BUILDPLATFORM node:22.2-alpine3.18@sha256:a46d9fcb38cae53de45b35b90f6df232342242bebc9323a417416eb67942979e AS client-builder
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
    org.opencontainers.image.vendor="Project Copacetic" \
    com.docker.desktop.extension.api.version="0.3.4" \
    com.docker.extension.screenshots="\
    [ \
    {\"alt\": \"Copa Light Screenshot\", \"url\": \"https://raw.githubusercontent.com/project-copacetic/copa-extension/main/.github/images/demo1.png\"}, \
    {\"alt\": \"Copa Dark Screenshot\", \"url\": \"https://raw.githubusercontent.com/project-copacetic/copa-extension/main/.github/images/demo2.png\"}, \
    {\"alt\": \"Copa Scan For Vulnerability\", \"url\": \"https://raw.githubusercontent.com/project-copacetic/copa-extension/main/.github/images/demo3.png\"}, \
    {\"alt\": \"Copa Vulnerability Display\", \"url\": \"https://raw.githubusercontent.com/project-copacetic/copa-extension/main/.github/images/demo4.png\"}, \
    {\"alt\": \"Copa Patching Image Show Console\", \"url\": \"https://raw.githubusercontent.com/project-copacetic/copa-extension/main/.github/images/demo5.png\"}, \
    {\"alt\": \"Copa Success Screen\", \"url\": \"https://raw.githubusercontent.com/project-copacetic/copa-extension/main/.github/images/demo6.png\"}, \
    {\"alt\": \"Copa Success Screen And Vuln Loading\", \"url\": \"https://raw.githubusercontent.com/project-copacetic/copa-extension/main/.github/images/demo7.png\"}, \
    {\"alt\": \"Copa Success Screen And Patched Image Vuln Display\", \"url\": \"https://raw.githubusercontent.com/project-copacetic/copa-extension/main/.github/images/demo8.png\"} \
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
