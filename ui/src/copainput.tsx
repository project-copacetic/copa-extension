
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
      const split = newValue.split(":");
      if (split.length === 1) {
        props.setSelectedImageTag("latest-patched");
      } else {
        props.setSelectedImageTag(split[1] + "-patched");
      }
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
            <FormControlLabel
              control={
                <Switch
                  checked={props.pushToRegistry}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    props.setPushToRegistry(event.target.checked);
                  }}
                />
              }
              label="Push to registry after patching"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={props.exitOnEol}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    props.setExitOnEol(event.target.checked);
                  }}
                />
              }
              label="Exit on End-of-Life OS detection"
            />
            <TextField
              id="eol-api-url-input"
              label="EOL API URL (optional)"
              placeholder="https://endoflife.date/api/v1/products"
              value={props.eolApiUrl === "default" ? "" : props.eolApiUrl}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                props.setEolApiUrl(event.target.value || "default");
              }}
              helperText="Leave empty to use default EOL API"
            />
            <FormControl fullWidth>
              <InputLabel id="platform-select-label">Platform</InputLabel>
              <Select
                labelId="platform-select-label"
                id="platform-select"
                value={props.selectedPlatform}
                label="Platform"
                onChange={(event: SelectChangeEvent) => {
                  props.setSelectedPlatform(event.target.value as string);
                }}
              >
                <MenuItem value="all">All platforms</MenuItem>
                <MenuItem value="linux/amd64">linux/amd64</MenuItem>
                <MenuItem value="linux/arm64">linux/arm64</MenuItem>
                <MenuItem value="linux/arm/v7">linux/arm/v7</MenuItem>
                <MenuItem value="linux/arm/v6">linux/arm/v6</MenuItem>
                <MenuItem value="linux/386">linux/386</MenuItem>
                <MenuItem value="linux/ppc64le">linux/ppc64le</MenuItem>
                <MenuItem value="linux/s390x">linux/s390x</MenuItem>
                <MenuItem value="linux/riscv64">linux/riscv64</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={props.ignoreErrors}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    props.setIgnoreErrors(event.target.checked);
                  }}
                />
              }
              label="Ignore errors (continue patching on failure)"
            />
            <FormControl fullWidth>
              <InputLabel id="progress-select-label">Progress Display</InputLabel>
              <Select
                labelId="progress-select-label"
                id="progress-select"
                value={props.progressMode}
                label="Progress Display"
                onChange={(event: SelectChangeEvent) => {
                  props.setProgressMode(event.target.value as string);
                }}
              >
                <MenuItem value="auto">Auto</MenuItem>
                <MenuItem value="plain">Plain</MenuItem>
                <MenuItem value="tty">TTY</MenuItem>
                <MenuItem value="quiet">Quiet</MenuItem>
                <MenuItem value="rawjson">Raw JSON</MenuItem>
              </Select>
            </FormControl>
            <Divider />
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              v0.12.0 Features
            </Typography>
            <TextField
              id="oci-dir-input"
              label="OCI Directory (optional)"
              placeholder="/path/to/oci/layout"
              value={props.ociDir}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                props.setOciDir(event.target.value);
              }}
              helperText="Local directory for OCI layout (for multi-platform local patching)"
            />
            <FormControl fullWidth>
              <InputLabel id="pkg-types-select-label">Package Types</InputLabel>
              <Select
                labelId="pkg-types-select-label"
                id="pkg-types-select"
                value={props.pkgTypes}
                label="Package Types"
                onChange={(event: SelectChangeEvent) => {
                  props.setPkgTypes(event.target.value as string);
                }}
              >
                <MenuItem value="os">OS packages only</MenuItem>
                <MenuItem value="library">Library packages only (Experimental)</MenuItem>
                <MenuItem value="os,library">OS + Library packages (Experimental)</MenuItem>
              </Select>
            </FormControl>
            {(props.pkgTypes === "library" || props.pkgTypes === "os,library") && (
              <Stack spacing={1}>
                <FormControl fullWidth>
                  <InputLabel id="library-patch-level-select-label">Library Patch Level</InputLabel>
                  <Select
                    labelId="library-patch-level-select-label"
                    id="library-patch-level-select"
                    value={props.libraryPatchLevel}
                    label="Library Patch Level"
                    onChange={(event: SelectChangeEvent) => {
                      props.setLibraryPatchLevel(event.target.value as string);
                    }}
                  >
                    <MenuItem value="patch">Patch (most conservative)</MenuItem>
                    <MenuItem value="minor">Minor (allow minor updates)</MenuItem>
                    <MenuItem value="major">Major (allow breaking changes)</MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="caption" color="warning.main" sx={{ fontStyle: 'italic' }}>
                  ⚠️ App-level patching is experimental. Supports Python and Node.js packages.
                </Typography>
              </Stack>
            )}
          </Stack>
        </Grow>
      </Collapse>
      <Divider />
      <Typography ><Box sx={{ fontWeight: 'bold', m: 1 }}>Fixable Vulnerabilities</Box></Typography>
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
          id='scan-or-patch-image-button'
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
