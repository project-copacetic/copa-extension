#!/bin/sh

set -ex;

image=$1
patched_tag=$2
timeout=$3
connection_format=$4
format=$5
output_file=$6

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

trivy image --vuln-type os --ignore-unfixed -f json -o scan.json $image

# run copa to patch image
if copa patch -i $image -r scan.json $connection --timeout $timeout $output;
then
    patched_image="$image_no_tag:$patched_tag"
    echo "patched-image=$patched_image"
else
    echo "Error patching image $image with copa"
    exit 1
fi
