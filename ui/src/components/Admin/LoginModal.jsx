import React, {useEffect} from 'react'
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import {Box, IconButton} from "@mui/material";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import CloseIcon from "@mui/icons-material/Close";
import TextField from "@mui/material/TextField";

export default function LoginModal({open, close, setLogin}) {
    const [openModal, setOpenModal] = React.useState(open);
    const [password, setPassword] = React.useState('');
    const [errorText, setErrorText] = React.useState(false);

    useEffect(() => {
        setOpenModal(open);
    }, [open]);

    const handleCloseModal = (login = false) => {
        if (login) {
            if (password === 'admin') {
                localStorage.setItem("login", new Date() + 1000 * 60 * 60); // 1 hour
                setErrorText(false);
                setOpenModal(false);
                close(true);
                setLogin(true);
            } else {
                setErrorText("Password incorrecta.");
            }
        } else {
            close(false);
        }
    };

    return (
        <Dialog open={openModal} onClose={() => handleCloseModal(false)}
                fullWidth={true}
                maxWidth='sm'
        >
            <DialogTitle className='modal__title'>Login</DialogTitle>
            <IconButton
                aria-label="close"
                onClick={() => handleCloseModal(false)}
                sx={(theme) => ({
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    color: theme.palette.grey[500],
                })}
            >
                <CloseIcon/>
            </IconButton>
            <DialogContent>
                <Box
                    noValidate
                    component="form"
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        m: 'auto',
                        width: 'fit-content',
                    }}
                >
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="password"
                        label="Password"
                        type="password"
                        autoFocus
                        error={errorText !== false}
                        helperText={errorText}
                        onKeyDown={(ev) => {
                            if (ev.key === 'Enter') {
                                handleCloseModal(true);
                                ev.preventDefault();
                            }
                        }}
                        onChange={(value) => setPassword(value.target.value)}
                    />

                </Box>
            </DialogContent>

            <DialogActions>
                <Button variant="contained" fullWidth={true} size="large"
                        onClick={() => handleCloseModal(true)}>Entrar</Button>
            </DialogActions>
        </Dialog>
    )
}
