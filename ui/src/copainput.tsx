
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
  CircularProgress,
  FormControlLabel,
  Switch,
  Tooltip,
  LinearProgress,
  Skeleton
} from '@mui/material';
import { ClickAwayListener } from '@mui/base';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import InfoIcon from '@mui/icons-material/Info';
import { VulnerabilityDisplay } from './vulnerabilitydisplay';

const VULN_UNLOADED = 0;
const VULN_LOADING = 1;
const VULN_LOADED = 2;

export function CopaInput(props: any) {

  const ddClient = createDockerDesktopClient();
  const [dockerImages, setDockerImages] = useState([] as string[]);
  const [selectedImageError, setSelectedImageError] = useState(false);
  const [selectedImageHelperText, setSelectedImageHelperText] = useState("");
  const [selectImageLabel, setSelectImageLabel] = useState("Remote Images");

  useEffect(() => {
    props.setSelectedImage("");
    if (props.useContainerdChecked) {
      fetchData();
      setSelectImageLabel("Local Image / Remote Image");
    } else {
      setDockerImages([]);
      setSelectImageLabel("Remote Image")
    }
  }, [props.useContainerdChecked]);

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

  const sumValues = (obj: Record<string, number>): number => {
    return Object.values(obj).reduce((accumulator, currentValue) => accumulator + currentValue, 0);
  };

  const hasWhiteSpace = (s: string) => {
    return s.indexOf(' ') >= 0;
  }

  const validateInput = () => {
    let inputValid: boolean = true;
    if (props.selectedImage === null || props.selectedImage.length === 0) {
      inputValid = false;
      setSelectedImageHelperText("Image input can not be empty.");
    } else if (hasWhiteSpace(props.selectedImage)) {
      inputValid = false;
      setSelectedImageHelperText("Image input can not have whitespace.");
    } else {

      let seperateSplit = props.selectedImage.split(':');
      let numColons = seperateSplit.length - 1;

      if (numColons > 1) {
        inputValid = false;
        setSelectedImageHelperText("Image input can only have one colon.");
      } else {
        if (seperateSplit[0].length === 0) {
          inputValid = false;
          setSelectedImageHelperText("Image input can not be a tag only.");
        }
      }
    }
    if (inputValid) {
      setSelectedImageHelperText("");
    }
    setSelectedImageError(!inputValid);
    return inputValid;
  }

  const handleLocalImageSwitchChecked = (event: React.ChangeEvent<HTMLInputElement>) => {
    props.setUseContainerdChecked(event.target.checked);
  };

  const handleSelectedImageChange = (event: any, newValue: string | null) => {
    props.setSelectedImage(newValue);
    if (newValue !== null) {
      let str1 = newValue.split(':').join('.');
      let str2 = str1.split("/").join('.');
      props.setJsonFileName(str2 + ".json");
    }
  }

  return (
    <Stack spacing={1.5}>
      <Stack>
        <Autocomplete
          freeSolo
          disablePortal
          value={props.selectedImage}
          onInputChange={handleSelectedImageChange}
          id="image-select-combo-box"
          options={dockerImages}
          onOpen={(event: React.SyntheticEvent) => {
            props.setVulnState(VULN_UNLOADED);
          }}
          sx={{ width: 300 }}
          disabled={props.vulnState === VULN_LOADING}
          renderInput={(params) =>
            <TextField
              {...params}
              label={selectImageLabel}
              error={selectedImageError}
              helperText={selectedImageHelperText}
            />}
        />
        {!props.useContainerdChecked &&
          <Stack direction="row" alignItems="center" spacing={1.05}>
            <Tooltip title={"Enable containerd image store to patch "
              + "local images (i.e. built or tagged locally but not pushed to a registry)."}>
              <InfoIcon fontSize='small' />
            </Tooltip>
            <Link href="#" onClick={() => {
              ddClient.host.openExternal("https://docs.docker.com/desktop/containerd/")
            }}>
              <Typography variant='caption'>Containerd image store not enabled</Typography>
            </Link>
          </Stack>}
      </Stack>
      <FormControl fullWidth>
        <InputLabel id="demo-simple-select-label" variant='outlined'>Scanner</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="demo-simple-select"
          value={props.selectedScanner}
          label="Scanner"
          onChange={(event: SelectChangeEvent) => {
            props.setSelectedScanner(event.target.value as string);
          }}
        >
          <MenuItem value={"trivy"}>Trivy</MenuItem>
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
      <Divider />
      <Typography ><Box sx={{ fontWeight: 'bold', m: 1 }}>Vulnerabilities</Box></Typography>
      <VulnerabilityDisplay
        vulnerabilityCount={props.vulnerabilityCount}
        vulnState={props.vulnState}
        setVulnState={props.setVulnState}
      />
      <Stack direction="row" spacing={2}>

        <Button disabled={
          props.vulnState === VULN_LOADING
          || (props.vulnState === VULN_LOADED
            && sumValues(props.vulnerabilityCount) === 0)
        }
          onClick={() => {
            if (props.vulnState === VULN_UNLOADED) {
              // If the input returns false with no errors, trigger the scan.
              const inputValid = validateInput();
              if (inputValid) {
                props.triggerTrivy();
              }
            } else if (props.vulnState === VULN_LOADED) {
              props.setVulnState(VULN_UNLOADED);
              props.patchImage();
            }
          }}
        >
          {props.vulnState === VULN_LOADED ? "Patch Image" : "Scan Image"}
        </Button>
        <Button onClick={() => {
          props.setInSettings(!props.inSettings);
        }} >Settings</Button>
      </Stack>
    </Stack>
  )
}
