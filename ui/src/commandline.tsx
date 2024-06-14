import React, { useState, useEffect, useRef } from 'react';
import {
    Paper,
    Typography
} from '@mui/material';
export function CommandLine(props: any) {

    const bottomRef = useRef<null | HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView();
    }, [props.totalStdout]);

    return (
        <Paper
            role="dialog"
            sx={{
                backgroundColor: '#000', // Black background
                color: '#ffffff', // Green text
                padding: '1rem', // Add some padding
                fontFamily: 'monospace', // Use monospace font
                fontSize: '0.9rem', // Adjust font size
                whiteSpace: 'pre-wrap', // Preserve line breaks
                overflow: 'scroll', // Allow horizontal scrolling
                borderRadius: '4px', // Add rounded corners
                maxHeight: '30vh',
                maxWidth: '50vw',
                minHeight: '30vh',
                minWidth: '50vw'
            }}
        >
            <Typography>{props.totalStdout}</Typography>
            <div ref={bottomRef}></div>
        </Paper>
    );
}



