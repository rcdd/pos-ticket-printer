import React from 'react';
import {
    Alert,
    AlertTitle,
    Box,
    Button,
    Collapse,
    IconButton,
    Snackbar,
    Stack,
    Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

function toMessage(errorOrString) {
    if (!errorOrString) return 'An unexpected error occurred.';
    if (typeof errorOrString === 'string') return errorOrString;
    if (errorOrString.message) return errorOrString.message;
    try {
        return JSON.stringify(errorOrString);
    } catch {
        return String(errorOrString);
    }
}

function toDetails(errorOrString) {
    if (!errorOrString) return '';
    if (typeof errorOrString === 'string') return '';
    const {stack, message, ...rest} = errorOrString;
    const extra = Object.keys(rest).length ? JSON.stringify(rest, null, 2) : '';
    return [stack, extra].filter(Boolean).join('\n');
}

export default function AlertSnackbar({
                                          open,
                                          type = 'success',
                                          title = 'Algo correu mal.',
                                          description,
                                          onClose,
                                          autoHideDuration = 6000,
                                          anchorOrigin = {vertical: 'top', horizontal: 'right'},
                                          onRetry,                   // optional () => void
                                          keepMounted = true,
                                      }) {
    const [showDetails, setShowDetails] = React.useState(false);

    React.useEffect(() => {
        if (open === true) setShowDetails(false);
    }, [open]);

    const message = toMessage(description);
    const details = toDetails(description);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(`${title}\n${message}\n\n${details}`);
        } catch {
            // ignore
        }
    };

    return (
        <Snackbar
            open={open}
            onClose={onClose}
            autoHideDuration={autoHideDuration}
            anchorOrigin={anchorOrigin}
            ClickAwayListenerProps={{mouseEvent: 'onMouseDown'}}
            keepMounted={keepMounted}
        >
            <Alert
                severity={type}
                variant="filled"
                onClose={onClose}
                sx={{minWidth: 360, maxWidth: 640, alignItems: 'flex-start'}}
                action={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        {onRetry && (
                            <Button
                                size="small"
                                color="inherit"
                                onClick={() => {
                                    onClose?.();
                                    onRetry();
                                }}
                            >
                                Retry
                            </Button>
                        )}
                        {details && (
                            <Tooltip title={showDetails ? 'Hide details' : 'Show details'}>
                                <IconButton
                                    size="small"
                                    color="inherit"
                                    aria-label="Toggle error details"
                                    onClick={() => setShowDetails((s) => !s)}
                                >
                                    <ExpandMoreIcon
                                        fontSize="small"
                                        style={{
                                            transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
                                            transition: '150ms'
                                        }}
                                    />
                                </IconButton>
                            </Tooltip>
                        )}
                        <Tooltip title="Copy">
                            <IconButton size="small" color="inherit" onClick={handleCopy} aria-label="Copy error">
                                <ContentCopyIcon fontSize="small"/>
                            </IconButton>
                        </Tooltip>
                        <IconButton size="small" color="inherit" onClick={onClose} aria-label="Close">
                            <CloseIcon fontSize="small"/>
                        </IconButton>
                    </Stack>
                }
            >
                <AlertTitle>{title}</AlertTitle>
                {message}
                <Collapse in={showDetails} unmountOnExit>
                    {details && (
                        <Box
                            component="pre"
                            sx={{
                                mt: 1,
                                p: 1,
                                bgcolor: 'rgba(0,0,0,0.25)',
                                borderRadius: 1,
                                maxHeight: 200,
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                fontSize: 12,
                            }}
                        >
                            {details}
                        </Box>
                    )}
                </Collapse>
            </Alert>
        </Snackbar>
    );
}
