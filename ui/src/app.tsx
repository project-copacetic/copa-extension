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
  DialogActions
} from '@mui/material';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import { CopaInput } from './copainput';

export function App() {
  const ddClient = createDockerDesktopClient();

  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [selectedScanner, setSelectedScanner] = React.useState<string | undefined>(undefined);
  const [selectedImageTag, setSelectedImageTag] = React.useState<string | undefined>(undefined);
  const [selectedTimeout, setSelectedTimeout] = React.useState<string | undefined>(undefined);
  const [totalStdout, setTotalStdout] = React.useState("");


  const [inSettings, setInSettings] = React.useState(false);
  const [showPreload, setShowPreload] = React.useState(true);
  const [showLoading, setShowLoading] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [showFailure, setShowFailure] = React.useState(false);
  const [showCopaOutputModal, setShowCopaOutputModal] = React.useState(false);



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
  }

  async function triggerCopa() {
    let stdout = "";
    let stderr = "";
    if (selectedImage != null) {
      let commandParts: string[] = [
        "--mount",
        "type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock",
        // "--name=copa-extension",
        "copa-extension",
        `${selectedImage}`,
        `${selectedImageTag === undefined ? `${selectedImage.split(':')[1]}-patched` : selectedImageTag}`,
        `${selectedTimeout === undefined ? "5m" : selectedTimeout}`,
        "buildx",
        "openvex"
      ];
      ({ stdout, stderr } = await runCopa(commandParts, stdout, stderr));
    }
  }

  async function runCopa(commandParts: string[], stdout: string, stderr: string) {
    let latestStdout: string = "";
    await ddClient.docker.cli.exec(
      "run", commandParts,
      {
        stream: {
          onOutput(data: any) {
            stdout += (data.stdout + "\n");
            if (data.stderr) {
              stderr += data.stderr;
              latestStdout = data.stderr;
            }
          },
          onError(error: any) {
            setTotalStdout(stdout);
            console.error(error);
          },
          onClose(exitCode: number) {
            setShowLoading(false);
            setTotalStdout(stdout);
            var res = { stdout: stdout, stderr: stderr };
            if (exitCode == 0) {
              processResult(res);
              setShowSuccess(true);
              ddClient.desktopUI.toast.success(`Copacetic - Created new patched image ${selectedImage}-patched`);
            } else {
              setShowFailure(true);
              ddClient.desktopUI.toast.error(`Copacetic - Failed to patch ${selectedImage}: ${latestStdout}`);
            }
          },
        },
      }
    );
    return { stdout, stderr };
  }

  const processResult = (res: object) => {

  }

  const loadingPage = (
    <Stack direction="row" alignContent="center" alignItems="center">
      <Box
        width={80}
      >
      </Box>
      <Stack>
        <CircularProgress size={100} />
        <Typography align='center' variant="h6" sx={{ maxWidth: 400 }}>Patching Image...</Typography>
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
        <Typography align='center' variant="h6">error here</Typography>
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
          <Link href="https://project-copacetic.github.io/copacetic/website/">LEARN MORE</Link>
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

