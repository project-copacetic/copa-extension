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
  Collapse,
  Paper,
  LinearProgress
} from '@mui/material';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import { CopaInput } from './copainput';
import { CommandLine } from './commandline';
import { VulnerabilityDisplay } from './vulnerabilitydisplay';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const VULN_UNLOADED = 0;
const VULN_LOADING = 1;
const VULN_LOADED = 2;

const IMAGE_NAME = "ghcr.io/project-copacetic/copa-extension";

const VOLUME_NAME = "copa-extension-volume";
const TRIVY_CONTAINER_NAME = "trivy-copa-extension-container";
const BUSYBOX_CONTAINER_NAME = "busybox-copa-extension-container";
const COPA_CONTAINER_NAME = "copa-extension-container";
const JSON_FILE_NAME = "scan.json";


export function App() {

  const learnMoreLink = "https://project-copacetic.github.io/copacetic/website/";

  const ddClient = createDockerDesktopClient();
  // The correct image name of the currently selected image. The latest tag is added if there is no tag.
  const [imageName, setImageName] = useState("");


  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedScanner, setSelectedScanner] = useState<string>("trivy");
  const [selectedImageTag, setSelectedImageTag] = useState<string>("");
  const [selectedTimeout, setSelectedTimeout] = useState<string>("5m");
  const [totalOutput, setTotalOutput] = useState("");
  const [errorText, setErrorText] = useState("");
  const [useContainerdChecked, setUseContainerdChecked] = useState(false);
  const [latestCopaVersion, setLatestCopaVerison] = useState("v0.7.0");

  const [inSettings, setInSettings] = useState(false);
  const [showPreload, setShowPreload] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFailure, setShowFailure] = useState(false);
  const [showCommandLine, setShowCommandLine] = useState(false);

  const baseImageName = selectedImage?.split(':')[0];


  const [vulnState, setVulnState] = useState(VULN_UNLOADED);

  const [vulnerabilityCount, setVulnerabilityCount] = useState<Record<string, number>>({
    "UNKNOWN": 0,
    "LOW": 0,
    "MEDIUM": 0,
    "HIGH": 0,
    "CRITICAL": 0
  });

  const getTrivyOutput = async () => {

    const output = await ddClient.docker.cli.exec("run", [
      "-v",
      "copa-extension-volume:/data",
      "--name",
      `${BUSYBOX_CONTAINER_NAME}`,
      "busybox",
      "cat",
      `data/${JSON_FILE_NAME}`
    ]);
    const data = JSON.parse(output.stdout);
    const severityMap: Record<string, number> = {
      "UNKNOWN": 0,
      "LOW": 0,
      "MEDIUM": 0,
      "HIGH": 0,
      "CRITICAL": 0
    };
    if (data.Results) {
      for (const result of data.Results) {
        if (result.Vulnerabilities) {
          for (const vulnerability of result.Vulnerabilities) {
            severityMap[vulnerability.Severity]++;
          }
        }
      }
    }
    setVulnerabilityCount(severityMap);
    setVulnState(VULN_LOADED);
  };

  // -- Effects --

  // On app launch, check for containerd
  useEffect(() => {
    const checkForContainerd = async () => {
      let containerdEnabled = await isContainerdEnabled();
      setUseContainerdChecked(containerdEnabled);
    }
    checkForContainerd();
  }, []);

  useEffect(() => {
    const fetchCopaVersion = async () => {
      const latestVersion = await getLatestCopaVerison();
      setLatestCopaVerison(latestVersion);
    }
    fetchCopaVersion();
  }, []);

  // -----------

  const patchImage = () => {

    setShowPreload(false);
    setShowLoading(true);
    triggerCopa();
  }

  const clearInput = () => {
    setSelectedImage(null);
    setSelectedScanner("trivy");
    setSelectedImageTag("");
    setSelectedTimeout("5m");
    setVulnerabilityCount({
      "UNKNOWN": 0,
      "LOW": 0,
      "MEDIUM": 0,
      "HIGH": 0,
      "CRITICAL": 0
    });
    setTotalOutput("");
    setVulnState(VULN_UNLOADED);
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

    setVulnState(VULN_LOADING);

    // Remove all previous containers.
    await ddClient.docker.cli.exec("rm", [
      "-f",
      `${TRIVY_CONTAINER_NAME}`,
      `${BUSYBOX_CONTAINER_NAME}`,
      `${COPA_CONTAINER_NAME}`
    ]);

    // Remove old volume
    await ddClient.docker.cli.exec("volume", [
      "rm",
      "-f",
      VOLUME_NAME
    ]);

    let commandParts: string[] = [
      "--mount",
      "type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock",
      "-v",
      `${VOLUME_NAME}:/output`,
      "--name",
      `${TRIVY_CONTAINER_NAME}`,
      "aquasec/trivy",
      "image",
      "--vuln-type",
      "os",
      "--ignore-unfixed",
      "--format",
      "json",
      "-o",
      `output/${JSON_FILE_NAME}`,
      `${selectedImage}`
    ];
    ({ stdout, stderr } = await runTrivy(commandParts, stdout, stderr));
  }

  const getImageTag = () => {
    if (selectedImage === null) {
      return;
    }
    // Create the correct tag for the image
    const imageSplit = selectedImage.split(':');
    if (selectedImageTag === undefined || selectedImageTag === "") {
      if (selectedImageTag !== undefined) {
        return selectedImageTag;
      } else if (imageSplit?.length === 1) {
        return `latest-patched`;
      } else {
        return `${imageSplit[1]}-patched`;
      }
    } else {
      return selectedImageTag;
    }
  }

  async function triggerCopa() {
    let stdout = "";
    let stderr = "";

    if (selectedImage != null) {
      let commandParts: string[] = [
        "--mount",
        "type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock",
        "--name",
        `${COPA_CONTAINER_NAME}`,
        "-v",
        "copa-extension-volume:/output",
        `${IMAGE_NAME}:${latestCopaVersion}`,
        `${selectedImage}`,
        `${JSON_FILE_NAME}`,
        `${getImageTag()}`,
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
              ddClient.desktopUI.toast.success(`Trivy scan finished`);
              getTrivyOutput();
            } else if (exitCode !== 137) {
              setVulnState(VULN_UNLOADED);
              ddClient.desktopUI.toast.error(`Trivy scan failed: ${stderr}`);
            }
          },
        },
      }
    );
    return { stdout, stderr };
  }




  async function isContainerdEnabled() {
    const result = await ddClient.docker.cli.exec('info', [
      '-f',
      '"{{ .DriverStatus }}"',
    ]);
    const output = result.stdout;
    return output.includes('driver-type io.containerd.snapshotter.v1');
  }

  async function getLatestCopaVerison() {
    const result = await ddClient.docker.cli.exec("run", [
      "curlimages/curl",
      "--retry",
      "5",
      "-s",
      "https://api.github.com/repos/project-copacetic/copacetic/releases/latest"
    ]);
    const output = result.stdout;
    const data = JSON.parse(output);
    return data.tag_name;
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
              const newImageName = `${baseImageName}:${getImageTag()}`;
              ddClient.desktopUI.toast.success(`Copacetic - Created new patched image ${newImageName}`);
              setSelectedImage(newImageName);
            } else {
              setShowFailure(true);
              ddClient.desktopUI.toast.error(`Copacetic - Failed to patch image ${selectedImage}`);
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
      <Stack sx={{ alignItems: 'center' }} spacing={2}>
        <CircularProgress size={100} />
        <Stack direction="row">
          {showCommandLineButton}
          <Typography variant="h6" sx={{ maxWidth: 400 }} id='loading-patch-text'>Patching Image...</Typography>
        </Stack>
        <Collapse unmountOnExit in={showCommandLine}>
          <CommandLine totalOutput={totalOutput}></CommandLine>
        </Collapse>
      </Stack>
    </Stack>
  )

  const successPage = (
    <Stack sx={{ alignItems: 'center' }} spacing={2}>
      <Box
        component="img"
        alt="celebration icon"
        src="celebration-icon.png"
      />
      <Stack sx={{ alignItems: 'center' }}>
        <Typography align='center' variant="h6">Created new patched image</Typography>
        <Stack direction="row">
          {showCommandLineButton}
          <Typography align='center' variant="h6" id="new-patched-image-name-text">{selectedImage}!</Typography>
        </Stack>
      </Stack>
      <Collapse unmountOnExit in={showCommandLine}>
        <CommandLine totalOutput={totalOutput}></CommandLine>
      </Collapse>
      <Stack direction="column" spacing={2} sx={{ alignSelf: 'inherit', alignItems: 'center' }}>
        {vulnState !== VULN_UNLOADED &&
          <Typography >
            <Box sx={{ fontWeight: 'bold' }}>Fixable Vulnerabilities:
            </Box>
          </Typography>
        }
        {vulnState !== VULN_UNLOADED &&
          < VulnerabilityDisplay
            vulnerabilityCount={vulnerabilityCount}
            vulnState={vulnState}
            setVulnState={setVulnState}
          />}
        <Stack direction="row" spacing={2}>
          <Button onClick={() => {
            triggerTrivy();
          }}
            disabled={vulnState === VULN_LOADING}
          >
            Scan Patched Image
          </Button>
          <Button
            onClick={() => {
              clearInput();
              setShowSuccess(false);
              setShowPreload(true);
            }}
            disabled={vulnState === VULN_LOADING}>
            Return
          </Button>
        </Stack>
      </Stack>
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
        <Typography align='center' variant="h6">Failed to patch {selectedImage}</Typography>
        <Stack direction="row">
          {showCommandLineButton}
          <Typography align='center' variant="h6">{errorText}</Typography>
        </Stack>
      </Stack>
      <Collapse unmountOnExit in={showCommandLine}>
        <CommandLine totalOutput={totalOutput}></CommandLine>
      </Collapse>
      <Button onClick={() => {
        clearInput();
        setShowFailure(false);
        setShowPreload(true);
      }}>Return</Button>
    </Stack>
  )

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
    >
      <Stack direction="row" spacing={2} alignItems='center'>
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
            vulnerabilityCount={vulnerabilityCount}
            triggerTrivy={triggerTrivy}
            getTrivyOutput={getTrivyOutput}
            vulnState={vulnState}
            setVulnState={setVulnState}
          />}
        {showLoading && loadingPage}
        {showSuccess && successPage}
        {showFailure && failurePage}
      </Stack>
    </Box>
  );
}

