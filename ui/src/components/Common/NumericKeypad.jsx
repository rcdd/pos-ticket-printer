import React from 'react';
import {Button, Paper, Popper, Stack, Typography, Box} from '@mui/material';
import BackspaceIcon from '@mui/icons-material/Backspace';

export const NumericKeypad = React.forwardRef(function NumericKeypad(
    {
        open,
        anchorEl,
        onKeyPress,
        placement = 'bottom-start',
        decimal,
        onDragHandlePointerDown,
    },
    paperRef
) {
    const keys = [
        ['7', '8', '9'],
        ['4', '5', '6'],
        ['1', '2', '3'],
        ['.', '0', 'BACK'],
    ];

    const press = (k) => () => onKeyPress?.(k);

    return (
        <Popper
            open={open}
            anchorEl={anchorEl}
            placement={placement}
            style={{zIndex: 1300}}
            modifiers={[{name: "offset", options: {offset: [0, 8]}}]}
        >
            <Paper ref={paperRef} elevation={6} sx={{p: 1.5, borderRadius: 2, minWidth: 220}}>
                <Box
                    onPointerDown={onDragHandlePointerDown}
                    sx={{
                        cursor: 'grab',
                        display: 'flex',
                        justifyContent: 'center',
                        mb: 1,
                        userSelect: 'none',
                    }}
                >
                    <Box sx={{width: 48, height: 6, borderRadius: 3, bgcolor: 'text.disabled', opacity: 0.5}}/>
                </Box>
                <Stack spacing={1}>
                    {keys.map((row, i) => (
                        <Stack key={i} direction="row" spacing={1}>
                            {row.map((k) => (
                                <Button
                                    key={k}
                                    variant="contained"
                                    onClick={press(k)}
                                    fullWidth
                                    disabled={(k === '.' || k === ',') && !decimal}
                                    sx={{py: 1.1, minWidth: 56}}
                                >
                                    {k === 'BACK' ? <BackspaceIcon fontSize="small"/> : (k === '.' ? ',' : k)}
                                </Button>
                            ))}
                        </Stack>
                    ))}
                    <Stack direction="row" spacing={1}>
                        <Button variant="outlined" color="warning" onClick={press('CLEAR')} fullWidth>
                            Limpar
                        </Button>
                        <Button variant="contained" color="success" onClick={press('OK')} fullWidth>
                            OK
                        </Button>
                    </Stack>
                    {decimal && <Typography variant="caption" sx={{opacity: 0.6, textAlign: 'center'}}>
                        Usa “,” ou “.” para decimais
                    </Typography>}
                </Stack>
            </Paper>
        </Popper>
    );
});
