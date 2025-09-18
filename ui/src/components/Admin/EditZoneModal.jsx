import React, {useEffect, useState} from 'react'
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import {Box, IconButton} from "@mui/material";
import TextField from "@mui/material/TextField";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import CloseIcon from '@mui/icons-material/Close';
import ZoneService from "../../services/zone.service";

function EditZoneModal({open, close, zone}) {
    const [openModal, setOpenModal] = React.useState(open);
    const [newName, setNewName] = useState(zone ? zone.name : null);
    const [newPosition, setNewPosition] = useState(zone ? zone.position : null);

    useEffect(() => {
        setOpenModal(open);
        setNewName(null);
        setNewPosition(0);
    }, [open]);

    const handleRemoveZone = async () => {
        await ZoneService.delete(zone.id).then((response) => {
            console.log(response);
        }).catch(
            (error) => {
                console.log(error.response);
                throw Error(error.response.data.message)
            }
        );
        close(false);
    }

    const handleCloseModal = async (status = false) => {
        if (status) {
            const bodyRequest = {
                id: zone.id,
                name: newName ?? zone.name,
                position: newPosition ?? zone.position
            };

            await ZoneService.update(bodyRequest).then((response) => {
                setNewName(null);
                setNewPosition(0);
            }).catch(
                (error) => {
                    console.log(error.response);
                    throw Error(error.response.data.message)
                }
            );


        }
        close(false);
    };

    return (
        <Dialog open={openModal} onClose={() => handleCloseModal(false)}
                fullwidth="true"
                maxWidth='sm'
        >
            <DialogTitle className='modal__title'>Editar Zona</DialogTitle>
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
                        id="name"
                        label="Nome"
                        name="name"
                        autoComplete="name"
                        autoFocus
                        defaultValue={zone ? zone.name : null}
                        onChange={(value) => setNewName(value.target.value)}
                    />

                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="position"
                        label="Posição"
                        name="position"
                        autoComplete="position"
                        autoFocus
                        defaultValue={zone ? zone.position : 0}
                        onChange={(value) => setNewPosition(value.target.value)}
                    />
                </Box>
            </DialogContent>

            <DialogActions>
                <Button variant="contained" fullWidth size="large" color="error"
                        onClick={handleRemoveZone}>Remover</Button>
                <Button variant="contained" fullWidth size="large"
                        onClick={() => handleCloseModal(true)}>Atualizar</Button>
            </DialogActions>
        </Dialog>
    )
}

export default EditZoneModal
