# How to contribute to the Copa Docker Desktop Extension

Before proceeding, ensure that Docker Desktop is installed on your computer and using the WSL backend if using Windows.

## Building the copa-extenion image
In order to run the extension locally, you need to build the `copa-extension` image specified in the `/container` folder so that the frontend can call `docker run` on the image.

Change your current directory to `/container` and run the following command:

```
docker build --platform=linux/amd64 --build-arg copa_version=0.6.2 -t copa-extension .
```
After the command finishes, confirm that an image named `copa-extension` is listed when you run the command `docker images` 

## Building the frontend image

Change back to the root directory of the repository and run the following two commands:

```
make build-extension
```
```
make install-extension
```
After following the steps, the extension should be successfully installed in Docker Desktop. If you make any changes to the code, simply run make `update-extension` to see those changes reflected. 


