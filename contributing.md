# How to contribute to the Copa Docker Desktop Extension

Before proceeding, ensure that Docker Desktop is installed on your computer and using the WSL backend if using Windows.

## Building the copa-extenion image
By default, the extension will pull the copa image from `ghcr.io/project-copacetic/copa-extension` and use that for the patching operation. If you would like to make modifications to this image and test locally, you need to build the `copa-extension` image image specified in the `/container/copa-extension` folder.

Run the following make command in the root directory to install it:

```
make build-copa-image
```
After the command finishes, confirm that the image `copa-extension` is listed when you run the command `docker images`. Once confirmed, change the `IMAGE_NAME` variable in `app.tsx` to point to  `copa-extension` instead of `ghcr.io/project-copacetic/copa-extension`.

## Building the frontend image

Change back to the root directory of the repository and run the following two commands:

```
make build-extension
```
```
make install-extension
```
After following the steps, the extension should be successfully installed in Docker Desktop. If you make any changes to the code, run `make update-extension` to see those changes reflected. 

## Install node packages locally

To use IntelliSense features (code completion, parameter info, quick info, and member lists), you need to install the node and yarn packages locally.

After installing [Node.js](https://nodejs.org/en/download/package-manager/), change to the `/ui` directory and run the following command:

```
npm install
```
If making changes to the testing code in `/e2e`, run `npm install --global yarn` to install the yarn package manager and then run the following command in the `/e2e` directory:
```
yarn install
```

