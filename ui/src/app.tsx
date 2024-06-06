// src/App.tsx
import React, { useState, useEffect } from 'react';
import { Autocomplete, Button, Box, TextField, Stack, Typography, Paper, Divider, MenuItem, IconButton, Link, Collapse, Grow, Fade, CircularProgress } from '@mui/material';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { createDockerDesktopClient } from '@docker/extension-api-client';

export function App() {
  const ddClient = createDockerDesktopClient();
  const [dockerImages, setDockerImages] = useState([] as string[]);
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [selectedScanner, setSelectedScanner] = React.useState<string | undefined>(undefined);
  const [inSettings, setInSettings] = React.useState(false);
  const [inLoading, setInLoading] = React.useState(false);

  const patchImage = () => {
    setInLoading(true);
    triggerCopa();
  }

  const simplePage = (
    <Fade in={!inLoading}>
      <Stack spacing={2}>
        <Autocomplete
          disablePortal
          value={selectedImage}
          onChange={(event: any, newValue: string | null) => {
            setSelectedImage(newValue);
          }}
          id="image-select-combo-box"
          options={dockerImages}
          sx={{ width: 300 }}
          renderInput={(params) => <TextField {...params} label="Image" />}
        />
        <FormControl fullWidth>
          <InputLabel id="demo-simple-select-label">Scanner</InputLabel>
          <Select
            labelId="demo-simple-select-label"
            id="demo-simple-select"
            value={selectedScanner}
            label="Age"
            onChange={(event: SelectChangeEvent) => {
              setSelectedScanner(event.target.value as string);
            }}
          >
            <MenuItem value={"trivy"}>Trivy</MenuItem>
            <MenuItem value={"other"}>Other</MenuItem>
          </Select>
        </FormControl>
        <Collapse in={inSettings}>
          <Grow in={inSettings}>
            <Stack spacing={2}>
              <TextField id="outlined-basic" label="Patched Image Tag" variant="outlined" />
              <TextField id="outlined-basic" label="Timeout" variant="outlined" />
              <TextField id="outlined-basic" label="Output Filename" variant="outlined" />
            </Stack>
          </Grow>
        </Collapse>
        <Stack direction="row" spacing={2}>
          <Button onClick={patchImage}>Patch image</Button>
          <Button onClick={() => {
            setInSettings(!inSettings);
          }} >Settings</Button>
        </Stack>
      </Stack>
    </Fade>
  );

  useEffect(() => {
    //Runs only on the first render
    const fetchData = async () => {
      const imagesList = await ddClient.docker.listImages();
      const listImages = (imagesList as []).map((images: any) => images.RepoTags)
        .sort()
        .filter((images: any) => images && "<none>:<none>" !== images[0])
        .flat();

      if (listImages.length == 0) {

      }
      setDockerImages(listImages);
    }
    fetchData();
  }, []);

  async function triggerCopa() {
    let stdout = "";
    let stderr = "";
    let commandParts: string[] = [
      "--mount",
      "type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock",
      // "--name=copa-extension",
      "copa-extension",
      `${selectedImage}`,
      "patched",
      "5m",
      "buildx",
      "openvex"
    ];
    ({ stdout, stderr } = await runCopa(commandParts, stdout, stderr));
  }

  async function runCopa(commandParts: string[], stdout: string, stderr: string) {
    await ddClient.docker.cli.exec(
      "run", commandParts,
      {
        stream: {
          onOutput(data: any) {
            stdout += data.stdout;
            if (data.stderr) {
              stderr += data.stderr;
            }
          },
          onError(error: any) {
            console.error(error);
          },
          onClose(exitCode: number) {
            setInLoading(false);
            var res = { stdout: stdout, stderr: stderr };
            if (exitCode == 0) {
              processResult(res);
            } else {
            
            }
          },
        },
      }
    );
    return { stdout, stderr };
  }

  const processResult = (res : object) => {
    
  }

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
        {!inLoading && simplePage}
        {inLoading &&
          <Stack direction="row">
            <Box
              width={80}
            >
            </Box>
            <CircularProgress size={150} />
          </Stack>}
      </Stack>
    </Box>
  );
}

