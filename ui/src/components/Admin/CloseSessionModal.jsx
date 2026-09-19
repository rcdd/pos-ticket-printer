import React, {useEffect} from 'react'
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import {Box, Checkbox, FormControlLabel, IconButton} from "@mui/material";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import CloseIcon from "@mui/icons-material/Close";
import TextFieldKeyboard from "../Common/TextFieldKeyboard";
import LoadingButton from "@mui/lab/LoadingButton";

export default function CloseSessionModal({open, setModal, onCloseSession}) {
    const [isLoading, setIsLoading] = React.useState(false);
    const [openModal, setOpenModal] = React.useState(open);
    const [notes, setNotes] = React.useState("");
    const [isTest, setIsTest] = React.useState(false);

    useEffect(() => {
        setOpenModal(open);
    }, [open]);

    const handleCloseModal = async (confirm = false) => {
        if (confirm) {
            setIsLoading(true);
            await onCloseSession(notes, isTest);
            setIsLoading(false);
        } else {
            setModal(false);
            setIsLoading(false);
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

                    <TextFieldKeyboard
                        value={notes}
                        onChange={(value) => setNotes(value)}
                        textFieldProps={{
                            label: 'Observações (opcional)',
                            multiline: true,
                            rows: 2,
                        }}
                    />

                    <FormControlLabel
                        sx={{mt: 1}}
                        control={
                            <Checkbox
                                checked={isTest}
                                onChange={(e) => setIsTest(e.target.checked)}
                            />
                        }
                        label="Sessão de teste / formação (escondida dos relatórios por omissão)"
                    />

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

                <LoadingButton
                    loading={isLoading}
                    variant="contained"
                    color="error"
                    onClick={() => {
                        handleCloseModal(true);
                    }}
                    disabled={isLoading}
                >
                    Fechar Turno
                </LoadingButton>
            </DialogActions>
        </Dialog>
    )
}
