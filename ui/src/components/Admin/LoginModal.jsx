import React, {useEffect} from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, IconButton, Button
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import UserService from "../../services/user.service";
import TextFieldKeyboard from "../Common/TextFieldKeyboard";

export default function LoginModal({open, close, setLogin}) {
    const [openModal, setOpenModal] = React.useState(open);
    const [username, setUsername] = React.useState("admin");
    const [password, setPassword] = React.useState("");
    const [errorText, setErrorText] = React.useState("");

    useEffect(() => {
        setOpenModal(open);
        setErrorText("");
        setPassword("")
    }, [open]);

    const handleCloseModal = (login = false) => {
        if (login) {
            UserService.login(username, password)
                .then((response) => {
                    localStorage.setItem("user", JSON.stringify(response.data));
                    localStorage.setItem("login", String(Date.now() + 60 * 60 * 1000));
                    setErrorText("");
                    setOpenModal(false);
                    close(true);
                    setLogin(true);
                })
                .catch(() => {
                    setErrorText("Utilizador ou password incorreta.");
                });
        } else {
            close(false);
        }
    };

    return (
        <Dialog
            open={openModal}
            onClose={() => handleCloseModal(false)}
            fullWidth
            maxWidth="xs"
        >
            <DialogTitle className="modal__title">Login</DialogTitle>

            <IconButton
                aria-label="Fechar"
                onClick={() => handleCloseModal(false)}
                sx={(theme) => ({
                    position: "absolute",
                    right: 8,
                    top: 8,
                    color: theme.palette.grey[500],
                })}
            >
                <CloseIcon/>
            </IconButton>

            <DialogContent>
                <Box
                    component="form"
                    noValidate
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        width: "100%",
                        maxWidth: 420,
                        m: "0 auto",
                    }}
                >
                    <TextFieldKeyboard
                        value={username}
                        onChange={setUsername}
                        textFieldProps={{
                            label: "Utilizador",
                            fullWidth: true,
                            autoComplete: "username",
                        }}
                        maxLength={64}
                        showSymbols={false}
                    />

                    <TextFieldKeyboard
                        value={password}
                        onChange={setPassword}
                        onEnter={() => handleCloseModal(true)}
                        textFieldProps={{
                            label: "Password",
                            type: "password",
                            fullWidth: true,
                            autoComplete: "current-password",
                            autoFocus: true,
                            onKeyDown: (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCloseModal(true);
                                }
                            }
                        }}
                        maxLength={64}
                        showSymbols={false}
                    />

                    {!!errorText && (
                        <Box sx={{color: "error.main", fontSize: 14}}>{errorText}</Box>
                    )}
                </Box>
            </DialogContent>

            <DialogActions>
                <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={() => handleCloseModal(true)}
                >
                    Entrar
                </Button>
            </DialogActions>
        </Dialog>
    );
}
