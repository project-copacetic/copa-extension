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
  Paper
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


export function App() {

  const learnMoreLink = "https://project-copacetic.github.io/copacetic/website/";

  const ddClient = createDockerDesktopClient();
  // The correct image name of the currently selected image. The latest tag is added if there is no tag.
  const [imageName, setImageName] = useState("");


  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedScanner, setSelectedScanner] = useState<string | undefined>("trivy");
  const [selectedImageTag, setSelectedImageTag] = useState<string | undefined>(undefined);
  const [selectedTimeout, setSelectedTimeout] = useState<string | undefined>(undefined);
  const [totalOutput, setTotalOutput] = useState("");
  const [errorText, setErrorText] = useState("");
  const [useContainerdChecked, setUseContainerdChecked] = useState(false);
  const [jsonFileName, setJsonFileName] = useState("default");


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
      "-e",
      `file=data/${jsonFileName}`,
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

  // -----------

  const patchImage = () => {

    setShowPreload(false);
    setShowLoading(true);
    triggerCopa();
  }

  const clearInput = () => {
    setSelectedImage(null);
    setSelectedScanner(undefined);
    setSelectedImageTag(undefined);
    setSelectedTimeout(undefined);
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

    // Force remove previous container
    await ddClient.docker.cli.exec("rm", [
      "-f",
      "trivy-copa-extension-container",
    ]);
    let commandParts: string[] = [
      "--mount",
      "type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock",
      "-v",
      "copa-extension-volume:/output",
      "--name",
      "trivy-copa-extension-container",
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
        // "--name=copa-extension",
        "-v",
        "copa-extension-volume:/output",
        "copa-extension",
        `${selectedImage}`,
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
              getTrivyOutput()
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
    const result = await ddClient.docker.cli.exec("info", [
      "--format",
      '"{{ json . }}"',
    ]);
    const info = JSON.parse(result.stdout);
    return info.Driver === "overlayfs";
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
              ddClient.desktopUI.toast.success(`Copacetic - Created new patched image ${baseImageName}:${getImageTag()}`);
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
          <Typography variant="h6" sx={{ maxWidth: 400 }}>Patching Image...</Typography>
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
        <Typography align='center' variant="h6">Failed to patch {selectedImage}</Typography>
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
            jsonFileName={jsonFileName}
            setJsonFileName={setJsonFileName}
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

