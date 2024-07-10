# How to contribute to the Copa Docker Desktop Extension

Before proceeding, ensure that Docker Desktop is installed on your computer and using the WSL backend if using Windows.

## Building the copa-extenion image
In order to run the extension locally, you need to build the `copa-extension` image and `cat-tool` image specified in the `/container` folder.

Run the following make command in the root directory to install both:

```
make build-helper-images
```
After the command finishes, confirm that the images `copa-extension` and `cat-tool` are listed when you run the command `docker images`.

## Building the frontend image

Change back to the root directory of the repository and run the following two commands:

```
make build-extension
```
```
make install-extension
```
After following the steps, the extension should be successfully installed in Docker Desktop. If you make any changes to the code, run `make update-extension` to see those changes reflected. 