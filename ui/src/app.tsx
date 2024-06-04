// src/App.tsx
import React, { useState, useEffect} from 'react';
import { Autocomplete, Button, Box, TextField} from '@mui/material';
import { createDockerDesktopClient } from '@docker/extension-api-client';

export function App() {
  const ddClient = createDockerDesktopClient();
  const [dockerImages, setDockerImages] = useState([] as string[]);
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);


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
            var res = { stdout: stdout, stderr: stderr };
            if (exitCode == 0) {
              ddClient.desktopUI.toast.error(
                `${res.stdout}`
              );
            } else {
              ddClient.desktopUI.toast.error(
                `${res.stderr}`
              );
            }
          },
        },
      }
    );
    return { stdout, stderr };
  }

  const patchImage = () => {
    triggerCopa();
  }


  return (
    <Box>
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
      <Button
        onClick={patchImage}
      >
        Patch Image
      </Button>
    </Box>
  );
}

