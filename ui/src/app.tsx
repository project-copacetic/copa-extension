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

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedScanner, setSelectedScanner] = useState<string | undefined>(undefined);
  const [selectedImageTag, setSelectedImageTag] = useState<string | undefined>(undefined);
  const [selectedTimeout, setSelectedTimeout] = useState<string | undefined>(undefined);
  const [totalStdout, setTotalStdout] = useState("");
  const [actualImageTag, setActualImageTag] = useState("");
  const [errorText, setErrorText] = useState("");
  const [useContainerdChecked, setUseContainerdChecked] = React.useState(false);


  const [inSettings, setInSettings] = useState(false);
  const [showPreload, setShowPreload] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFailure, setShowFailure] = useState(false);
  const [showCopaOutputModal, setShowCopaOutputModal] = useState(false);
  const [showCommandLine, setShowCommandLine] = useState(false);



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
    setTotalStdout("");
    setActualImageTag("");
  }

  const processError = (error: string) => {
    if (error.indexOf("No such image") >= 0) {
      setErrorText("Image does not exist.");
    } else {
      setErrorText("Undefined error.");
    }
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
        "copa-extension",
        `${selectedImage}`,
        `${imageTag}`,
        `${selectedTimeout === undefined ? "5m" : selectedTimeout}`,
        `${useContainerdChecked ? 'custom-socket' : 'buildx'}`,
        "openvex"
      ];
      ({ stdout, stderr } = await runCopa(commandParts, stdout, stderr));
    }
  }

  async function runCopa(commandParts: string[], stdout: string, stderr: string) {
    let latestStderr: string = "";
    await ddClient.docker.cli.exec(
      "run", commandParts,
      {
        stream: {
          onOutput(data: any) {
            stdout += data.stdout;
            setTotalStdout(totalStdout + stdout)
            if (data.stderr) {
              stderr += data.stderr;
              latestStderr = data.stderr;
            }
          },
          onError(error: any) {
            // Not sure what do to with this.
          },
          onClose(exitCode: number) {
            setShowLoading(false);
            setTotalStdout(stdout);
            var res = { stdout: stdout, stderr: stderr };
            if (exitCode == 0) {
              setShowSuccess(true);
              ddClient.desktopUI.toast.success(`Copacetic - Created new patched image ${selectedImage}-${actualImageTag}`);
            } else {
              setShowFailure(true);
              ddClient.desktopUI.toast.error(`Copacetic - Failed to patch ${selectedImage}: ${stderr}`);
              processError(latestStderr);
            }
          },
        },
      }
    );
    return { stdout, stderr };
  }

  const loadingPage = (
    <Stack direction="row" alignContent="center" alignItems="center">
      <Box
        width={80}
      >
      </Box>
      <Stack sx={{ alignItems: 'center' }}>
        <CircularProgress size={100} />
        <Stack direction="row">
          <IconButton aria-label="show-command-line" onClick={() => { setShowCommandLine(!showCommandLine) }}>
            {showCommandLine ? <ExpandMoreIcon /> : <ChevronRightIcon />}
          </IconButton>
          <Typography variant="h6" sx={{ maxWidth: 400 }}>Patching Image...</Typography>
        </Stack>
        <Collapse in={showCommandLine}>
          <CommandLine totalStdout={totalStdout}></CommandLine>
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
      <Box>
        <Typography align='center' variant="h6">Successfully patched image</Typography>
        <Typography align='center' variant="h6">{selectedImage}!</Typography>
      </Box>
      <Stack direction="row" spacing={2}>
        <Button onClick={() => {
          clearInput();
          setShowSuccess(false);
          setShowPreload(true);
        }}>Return</Button>
        <Button onClick={() => { setShowCopaOutputModal(true) }}>Show Copa Output</Button>
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
      <Box>
        <Typography align='center' variant="h6">Failed to patch {selectedImage}:</Typography>
        <Typography align='center' variant="h6">{errorText}</Typography>
      </Box>
      <Stack direction="row" spacing={2}>
        <Button onClick={() => {
          clearInput();
          setShowFailure(false);
          setShowPreload(true);
        }}>Return</Button>
        <Button onClick={() => { setShowCopaOutputModal(true) }}>Show Copa Output</Button>
      </Stack>
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
            ddClient.host.openExternal(
              "https://project-copacetic.github.io/copacetic/website/"
            )
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
          />}
        {showLoading && loadingPage}
        {showSuccess && successPage}
        {showFailure && failurePage}
        <Dialog
          open={showCopaOutputModal}
          onClose={() => { setShowCopaOutputModal(false) }}
          scroll='paper'
          aria-labelledby="scroll-dialog-title"
          aria-describedby="scroll-dialog-description"
          maxWidth='xl'
          fullWidth
        >
          <DialogTitle id="scroll-dialog-title">Copa Output</DialogTitle>
          <DialogContent dividers={true}>
            <DialogContentText
              id="scroll-dialog-description"
              tabIndex={-1}
            >
              {totalStdout}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setShowCopaOutputModal(false) }}>Back</Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Box>
  );
}

