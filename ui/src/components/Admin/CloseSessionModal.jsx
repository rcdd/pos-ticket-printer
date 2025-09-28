import React, {useEffect} from 'react'
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import {Box, IconButton} from "@mui/material";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import CloseIcon from "@mui/icons-material/Close";
import SessionService from "../../services/session.service";
import {useToast} from "../Common/ToastProvider";

export default function CloseSessionModal({open, setModal, onCloseSession, session, setSession, closingAmount}) {
    const [openModal, setOpenModal] = React.useState(open);
    const {pushNetworkError} = useToast();

    useEffect(() => {
        setOpenModal(open);
    }, [open]);

    const handleCloseModal = (confirm = false) => {
        if (confirm) {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) {
                pushNetworkError(null, {
                    title: 'Utilizador não autenticado',
                    message: 'Por favor, inicie sessão novamente.',
                });
                return;
            }

            const payload = {
                userId: user.id,
                closingAmount: closingAmount,
                notes: null,
            };
            SessionService.close(session.id, payload).then(() => {
                setSession(null);
                setOpenModal(false);
                onCloseSession(true);
            }).catch((error) => {
                pushNetworkError(error, {
                    title: 'Não foi possivel fechar a sessão',
                });
                console.error(error.response.data);
            });
        } else {
            setModal(false);
        }
    };

    return (
        <Dialog open={openModal} onClose={() => handleCloseModal(false)}
                fullwidth="true"
                maxWidth='sm'
        >
            <DialogTitle className='modal__title'>Fechar Sessão</DialogTitle>
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
                    <p>Tem a certeza que pretende fechar o turno?</p>
                    <p>Após fechar o turno não será possível registar mais vendas nesta sessão.</p>


                </Box>
            </DialogContent>

            <DialogActions>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {
                        handleCloseModal(false);
                    }}
                >
                    Cancelar
                </Button>
                <Button
                    variant="contained"
                    color="error"
                    onClick={() => {
                        handleCloseModal(true);
                    }}
                >
                    Fechar Turno
                </Button>
            </DialogActions>
        </Dialog>
    )
}
