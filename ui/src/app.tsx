// src/App.tsx
import React, { useState, useEffect } from 'react';
import {
  Autocomplete,
  Button,
  Box,
  Stack,
  Typography,
  Divider,
  Link,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Grow,
  Collapse
} from '@mui/material';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import { CopaInput } from './copainput';
import { CommandLine } from './commandline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export function App() {
  const ddClient = createDockerDesktopClient();
  const learnMoreLink = "https://project-copacetic.github.io/copacetic/website/";

  // The correct image name of the currently selected image. The latest tag is added if there is no tag.
  const [imageName, setImageName] = useState("");


  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedScanner, setSelectedScanner] = useState<string | undefined>("trivy");
  const [selectedImageTag, setSelectedImageTag] = useState<string | undefined>(undefined);
  const [selectedTimeout, setSelectedTimeout] = useState<string | undefined>(undefined);
  const [totalOutput, setTotalOutput] = useState("");
  const [actualImageTag, setActualImageTag] = useState("");
  const [errorText, setErrorText] = useState("");
  const [useContainerdChecked, setUseContainerdChecked] = React.useState(false);
  const [jsonFileName, setJsonFileName] = useState("default");


  const [inSettings, setInSettings] = useState(false);
  const [showPreload, setShowPreload] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFailure, setShowFailure] = useState(false);
  const [showCopaOutputModal, setShowCopaOutputModal] = useState(false);
  const [showCommandLine, setShowCommandLine] = useState(false);
  const [finishedScan, setFinishedScan] = useState(false);

  useEffect(() => {
    const getTrivyOutput = async () => {
      const output = await ddClient.docker.cli.exec("run", [
        "-v",
        "myVolume:/data",
        "-e",
        "file=data/nginx.1.21.6.json",
        "cat-tool"
      ]);
      const data = JSON.parse(output.stdout);
      const severityMap: Record<string, number> = {
        "UNKNOWN": 0,
        "LOW": 0,
        "MEDIUM": 0,
        "HIGH": 0,
        "CRITICAL": 0
      };
      for (const result of data.Results) {
        for (const vulnerability of result.Vulnerabilities) {
          severityMap[vulnerability.Severity]++;
        }
      }
    };
    if (finishedScan) {
      getTrivyOutput();
      triggerCopa();
    }
  }, [finishedScan]);



  const patchImage = () => {
    setShowPreload(false);
    setShowLoading(true);
    triggerTrivy();
  }

  const clearInput = () => {
    setSelectedImage(null);
    setSelectedScanner(undefined);
    setSelectedImageTag(undefined);
    setSelectedTimeout(undefined);
    setTotalOutput("");
    setImageName("");
    setActualImageTag("");
  }

  const processError = (error: string) => {
    if (error.indexOf("unknown tag") >= 0) {
      setErrorText("Unknown image tag.")
    } else if (error.indexOf("No such image") >= 0) {
      setErrorText("Image does not exist.");
    } else {
      setErrorText("An unexpected error occurred.");
    }
  }

  async function triggerTrivy() {
    let stdout = ""
    let stderr = ""

    let commandParts: string[] = [
      "-v",
      "myVolume:/output",
      "aquasec/trivy",
      "image",
      "--vuln-type",
      "os",
      "--ignore-unfixed",
      "--format",
      "json",
      "-o",
      `output/${jsonFileName}`,
      `${selectedImage}`
    ];
    ({ stdout, stderr } = await runTrivy(commandParts, stdout, stderr));
  }

  async function triggerCopa() {
    let stdout = "";
    let stderr = "";


    let imageTag = "";
    // Create the correct tag for the image
    if (selectedImage !== null) {
      let imageSplit = selectedImage.split(':');
      if (selectedImageTag !== undefined) {
        imageTag = selectedImageTag;
      } else if (imageSplit?.length === 1) {
        imageTag = `latest-patched`;
      } else {
        imageTag = `${imageSplit[1]}-patched`;
      }
    }
    setActualImageTag(imageTag);

    if (selectedImage != null) {
      let commandParts: string[] = [
        "--mount",
        "type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock",
        // "--name=copa-extension",
        "-v",
        "myVolume:/output",
        "copa-extension",
        `${selectedImage}`,
        `${jsonFileName}`,
        `${imageTag}`,
        `${selectedTimeout === undefined ? "5m" : selectedTimeout}`,
        `${useContainerdChecked ? 'custom-socket' : 'buildx'}`,
        "openvex"
      ];
      ({ stdout, stderr } = await runCopa(commandParts, stdout, stderr));
    }
  }

  async function runTrivy(commandParts: string[], stdout: string, stderr: string) {
    let tOutput = totalOutput;
    await ddClient.docker.cli.exec(
      "run", commandParts,
      {
        stream: {
          onOutput(data: any) {
            if (data.stdout) {
              stdout += data.stdout;
              tOutput += data.stdout;

            }
            if (data.stderr) {
              stderr += data.stderr;
              tOutput += data.stderr;
            }
            setTotalOutput(tOutput);
          },
          onClose(exitCode: number) {
            if (exitCode == 0) {
              ddClient.desktopUI.toast.success(`Trivy scan finshed`);
              setFinishedScan(true);
            } else {
              ddClient.desktopUI.toast.error(`Trivy scan failed`);
            }
          },
        },
      }
    );
    return { stdout, stderr };
  }




  async function runCopa(commandParts: string[], stdout: string, stderr: string) {
    let latestStderr: string = "";
    let tOutput = totalOutput;
    await ddClient.docker.cli.exec(
      "run", commandParts,
      {
        stream: {
          onOutput(data: any) {

            if (data.stdout) {
              stdout += data.stdout;
              tOutput += data.stdout;

            }
            if (data.stderr) {
              stderr += data.stderr;
              tOutput += data.stderr;
              latestStderr = data.stderr;
            }
            setTotalOutput(tOutput);
          },
          onClose(exitCode: number) {
            setShowLoading(false);
            if (exitCode == 0) {
              setShowSuccess(true);
              ddClient.desktopUI.toast.success(`Copacetic - Created new patched image ${selectedImage}-${actualImageTag}`);
            } else {
              setShowFailure(true);
              ddClient.desktopUI.toast.error(`Copacetic - Failed to patch image ${imageName}`);
              processError(latestStderr);
            }
          },
        },
      }
    );
    return { stdout, stderr };
  }

  const showCommandLineButton = (
    <IconButton aria-label="show-command-line" onClick={() => { setShowCommandLine(!showCommandLine) }}>
      {showCommandLine ? <ExpandMoreIcon /> : <ChevronRightIcon />}
    </IconButton>
  )

  const loadingPage = (
    <Stack direction="row" alignContent="center" alignItems="center">
      <Box
        width={80}
      >
      </Box>
      <Stack sx={{ alignItems: 'center' }}>
        <CircularProgress size={100} />
        <Stack direction="row">
          {showCommandLineButton}
          <Typography variant="h6" sx={{ maxWidth: 400 }}>{finishedScan ? "Patching Image..." : "Scanning Image..."}</Typography>
        </Stack>
        <Collapse in={showCommandLine}>
          <CommandLine totalOutput={totalOutput}></CommandLine>
        </Collapse>
      </Stack>
    </Stack>
  )

  const successPage = (
    <Stack sx={{ alignItems: 'center' }} spacing={1.5}>
      <Box
        component="img"
        alt="celebration icon"
        src="celebration-icon.png"
      />
      <Stack sx={{ alignItems: 'center' }}>
        <Typography align='center' variant="h6">Successfully patched image</Typography>
        <Stack direction="row">
          {showCommandLineButton}
          <Typography align='center' variant="h6">{selectedImage}!</Typography>
        </Stack>
      </Stack>
      <Button
        onClick={() => {
          clearInput();
          setShowSuccess(false);
          setShowPreload(true);
        }}>
        Return
      </Button>
      <Collapse in={showCommandLine}>
        <CommandLine totalOutput={totalOutput}></CommandLine>
      </Collapse>
    </Stack>
  );

  const failurePage = (
    <Stack sx={{ alignItems: 'center' }} spacing={1.5}>
      <Box
        component="img"
        alt="error icon"
        src="error-icon.png"
      />
      <Stack sx={{ alignItems: 'center' }} >
        <Typography align='center' variant="h6">Failed to patch {imageName}</Typography>
        <Stack direction="row">
          {showCommandLineButton}
          <Typography align='center' variant="h6">{errorText}</Typography>
        </Stack>
      </Stack>
      <Button onClick={() => {
        clearInput();
        setShowFailure(false);
        setShowPreload(true);
      }}>Return</Button>
      <Collapse in={showCommandLine}>
        <CommandLine totalOutput={totalOutput}></CommandLine>
      </Collapse>
    </Stack>
  )

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
    >
      <Stack direction="row" spacing={2}>
        <Stack sx={{ alignItems: 'center' }} spacing={1.5}>
          <Box
            component="img"
            alt="Copacetic logo"
            src="copa-color-small.png"
          />
          <Stack>
            <Typography align='center' variant="h6">Directly patch containers quickly</Typography>
            <Typography align='center' variant="h6">without going upstream for a full rebuild.</Typography>
          </Stack>
          <Link onClick={() => {
            ddClient.host.openExternal(learnMoreLink)
          }}>LEARN MORE</Link>
        </Stack>
        <Divider orientation="vertical" variant="middle" flexItem />
        {showPreload &&
          <CopaInput
            selectedImage={selectedImage}
            setSelectedImage={setSelectedImage}
            selectedScanner={selectedScanner}
            setSelectedScanner={setSelectedScanner}
            selectedImageTag={selectedImageTag}
            setSelectedImageTag={setSelectedImageTag}
            selectedTimeout={selectedTimeout}
            setSelectedTimeout={setSelectedTimeout}
            inSettings={inSettings}
            setInSettings={setInSettings}
            patchImage={patchImage}
            useContainerdChecked={useContainerdChecked}
            setUseContainerdChecked={setUseContainerdChecked}
            imageName={imageName}
            setImageName={setImageName}
            jsonFileName={jsonFileName}
            setJsonFileName={setJsonFileName}
          />}
        {showLoading && loadingPage}
        {showSuccess && successPage}
        {showFailure && failurePage}
      </Stack>
    </Box>
  );
}

