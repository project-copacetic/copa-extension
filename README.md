# Docker Desktop Copa Extension
Copa Docker Desktop Extension
![starting page for the extension](https://raw.githubusercontent.com/jgrer/copa-extension/dockerfile-label-documentation/.github/images/demo1.png)

## What is this extension for?

`copa` is a CLI tool written in Go and based on buildkit that can be used to directly patch container images given the vulnerability scanning results from popular tools like Trivy. This extension allows the user to leverage the abilities of the CLI tool without having install a scanner or the CLI tool itself. The only requirement to use this extension is Docker Desktop! 

## How does it work?

This extension is a web application displayed in a tab of the dashboard in Docker Desktop. It is written in Javascript using the React Javascript library and Material UI react component library. It creates three containers to scan an image, send vulnerability information to the frontend, and patch an image. It uses the `copa-extension-volume` to share the scan result between the three containers.

### Images/Containers

|Image | Container        | Description                                                                                                          |
| -----|------------- | ---------------------------------------------------------------------------------------------------------------------|
|`aquasec/trivy`| `trivy-copa-extension-container`          | Runs a scan of the selected image and outputs the json file result `scan.json` to the volume `copa-extension-volume` |
| `busybox`| `busybox-copa-extension-container`          | Runs the `cat` command to dump the json output file `scan.json` to `stdout`|
|`copa-extension` | `copa-extension-container`     | Runs a copa patch on the selected image using the vulnerability results from `scan.json` |


### Components

| Component           | Description                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------|
| `main.tsx`          | Main entry point of the frontend, meant to set up React                                                              |
| `app.tsx`           | Contains the other main components and the left side of the UI, which includes the Copa logo and learn more link. Also includes the frontend code for the loading screen, success screen, and failure screen
| `copainput.tsx`     | Has TextFields, Autocompletes, and Buttons to gather input. Displayed on the right side when first loading the page. |
| `commandline.tsx`   | Stylized display to look like the command line for the stdout and stderr from the container running Copacetic        |
| `vulnerabilitydisplay.tsx`| Displays the vulnerability results from a trivy scan, similar to the docker scout vulnerability display|

## How do install it?

The extension be installed using this link! It can also be installed with the following command:

```
docker extension install copacetic/copacetic-docker-desktop-extension:0.1.0
```