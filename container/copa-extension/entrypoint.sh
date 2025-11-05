#!/bin/sh

set -ex;

image=$1
report=$2
patched_tag=$3
timeout=$4
connection_format=$5
format=$6
output_file=$7
push_flag=$8
exit_on_eol=$9
eol_api_url=${10}
platform=${11}
ignore_errors=${12}
progress=${13}
oci_dir=${14}
pkg_types=${15}
library_patch_level=${16}

# parse image into image name
image_no_tag=$(echo "$image" | cut -d':' -f1)

# check if output_file has been set
if [ -z "$output_file" ]
then
    output=""
else
    output="--format $format --output ./data/$output_file"
fi

# check selected method of buildkit connection
case "$connection_format" in
    # through a buildx instance
    "buildx")
        docker buildx create --name=copa-action
        docker buildx use --default copa-action
        connection="--addr buildx://copa-action"
    ;;
    # through a running buildkit container over tcp
    "buildkit-container")
        connection="--addr tcp://127.0.0.1:8888"
    ;;
    # through the default docker buildkit endpoint enabled with a custom socket
    "custom-socket")
        connection=""
    ;;
esac

# build optional flags
optional_flags=""

# add push flag if enabled
if [ "$push_flag" = "true" ]; then
    optional_flags="$optional_flags --push"
fi

# add exit-on-eol flag if enabled
if [ "$exit_on_eol" = "true" ]; then
    optional_flags="$optional_flags --exit-on-eol"
fi

# add eol-api-url if provided
if [ -n "$eol_api_url" ] && [ "$eol_api_url" != "default" ]; then
    optional_flags="$optional_flags --eol-api-url=$eol_api_url"
fi

# add platform if provided
if [ -n "$platform" ] && [ "$platform" != "all" ]; then
    optional_flags="$optional_flags --platform=$platform"
fi

# add ignore-errors flag if enabled
if [ "$ignore_errors" = "true" ]; then
    optional_flags="$optional_flags --ignore-errors"
fi

# add progress flag if provided
if [ -n "$progress" ] && [ "$progress" != "auto" ]; then
    optional_flags="$optional_flags --progress=$progress"
fi

# add oci-dir flag if provided (v0.12.0)
if [ -n "$oci_dir" ]; then
    optional_flags="$optional_flags --oci-dir=$oci_dir"
fi

# add pkg-types flag if not default (v0.12.0)
if [ -n "$pkg_types" ] && [ "$pkg_types" != "os" ]; then
    optional_flags="$optional_flags --pkg-types=$pkg_types"
fi

# add library-patch-level flag if library patching is enabled (v0.12.0)
if [ "$pkg_types" = "library" ] || [ "$pkg_types" = "os,library" ]; then
    if [ -n "$library_patch_level" ] && [ "$library_patch_level" != "patch" ]; then
        optional_flags="$optional_flags --library-patch-level=$library_patch_level"
    fi
    # Set experimental flag for app-level patching
    export COPA_EXPERIMENTAL=1
fi

# run copa to patch image
if copa patch -i $image -r output/"$report" -t "$patched_tag" $connection --timeout $timeout $output $optional_flags;
then
    patched_image="$image_no_tag:$patched_tag"
    echo "patched-image=$patched_image"
else
    echo "Error patching image $image with copa"
    exit 1
fi
