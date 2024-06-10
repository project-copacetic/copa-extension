
import React, { useState, useEffect } from 'react';
import {
  Autocomplete,
  Button,
  Box,
  TextField,
  Stack,
  Typography,
  Paper,
  Divider,
  MenuItem,
  IconButton,
  Link,
  Collapse,
  Grow,
  Fade,
  CircularProgress
} from '@mui/material';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { createDockerDesktopClient } from '@docker/extension-api-client';
export function CopaInput(props: any) {

  const ddClient = createDockerDesktopClient();
  const [dockerImages, setDockerImages] = useState([] as string[]);

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

  return (
    <Stack spacing={2}>
      <Autocomplete
        freeSolo
        disablePortal
        value={props.selectedImage}
        onInputChange={(event: any, newValue: string | null) => {
          props.setSelectedImage(newValue);
        }}
        id="image-select-combo-box"
        options={dockerImages}
        sx={{ width: 300 }}
        renderInput={(params) => <TextField {...params} label="Image" error={true} helperText="test" />}
      />
      <FormControl fullWidth>
        <InputLabel id="demo-simple-select-label">Scanner</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="demo-simple-select"
          value={props.selectedScanner}
          label="Age"
          onChange={(event: SelectChangeEvent) => {
            props.setSelectedScanner(event.target.value as string);
          }}
        >
          <MenuItem value={"trivy"}>Trivy</MenuItem>
          <MenuItem value={"other"}>Other</MenuItem>
        </Select>
      </FormControl>
      <Collapse in={props.inSettings}>
        <Grow in={props.inSettings}>
          <Stack spacing={2}>
            <TextField
              id="image-tag-input"
              label="Patched Image Tag"
              value={props.selectedImageTag}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                props.setSelectedImageTag(event.target.value);
              }}
            />
            <TextField
              id="timeout-input"
              label="Timeout"
              value={props.selectedTimeout}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                props.setSelectedTimeout(event.target.value);
              }}
            />
          </Stack>
        </Grow>
      </Collapse>
      <Stack direction="row" spacing={2}>
        <Button onClick={props.patchImage}>Patch image</Button>
        <Button onClick={() => {
          props.setInSettings(!props.inSettings);
        }} >Settings</Button>
      </Stack>
    </Stack>
  )
}
