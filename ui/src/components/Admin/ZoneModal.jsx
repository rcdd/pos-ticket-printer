import React, { useEffect, useMemo, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, IconButton, TextField, Button
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ZoneService from '../../services/zone.service';
import TextFieldKeyboard from "../Common/TextFieldKeyboard";

function ZoneModal({ open, close, zone, allZones = [] }) {
    const [name, setName] = useState('');
    const [position, setPosition] = useState(0);

    useEffect(() => {
        if (!open) return;
        setName(zone?.name ?? '');
        setPosition(Number.isInteger(zone?.position) ? zone.position : allZones.length);
    }, [open, zone, allZones.length]);

    const isValid = useMemo(() => {
        return name.trim().length > 0 && Number.isInteger(position) && position >= 0;
    }, [name, position]);

    const handleRemoveZone = async () => {
        if (!zone?.id) return close(false);
        try {
            await ZoneService.delete(zone.id);
            close(true);
        } catch (error) {
            console.log(error?.response || error);
            close(false);
        }
    };

    const addZoneRequest = async () => {
        const body = { name: name.trim(), position };
        try {
            await ZoneService.create(body);
            close(true);
        } catch (error) {
            console.log(error?.response || error);
            close(false);
        }
    };

    const updateZoneRequest = async () => {
        if (!zone?.id) return close(false);
        const body = { id: zone.id, name: name.trim(), position };
        try {
            await ZoneService.update(body);
            close(true);
        } catch (error) {
            console.log(error?.response || error);
            close(false);
        }
    };

    const handleCloseModal = async (submit = false, isUpdate = false) => {
        if (submit && isValid) {
            if (isUpdate) await updateZoneRequest();
            else await addZoneRequest();
            return;
        }
        close(false);
    };

    return (
        <Dialog open={open} onClose={() => handleCloseModal(false)} fullWidth maxWidth="sm">
            <DialogTitle className="modal__title">
                {zone ? 'Editar' : 'Adicionar'} Zona
            </DialogTitle>

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
                <CloseIcon />
            </IconButton>

            <DialogContent>
                <Box
                    component="form"
                    noValidate
                    sx={{ display: 'flex', flexDirection: 'column', m: 'auto', width: 'fit-content' }}
                >
                    <TextFieldKeyboard
                        value={name}
                        onChange={setName}
                        textFieldProps={{
                            label: 'Nome',
                            fullWidth: true,
                            autoComplete: "nome",
                            required: true,
                        }}
                        maxLength={20}
                        showSymbols={false}
                    />

                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="zone-position"
                        label="Posição"
                        name="position"
                        type="number"
                        inputProps={{ min: 0, step: 1 }}
                        value={Number.isFinite(position) ? position : ''}
                        onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (Number.isNaN(v)) setPosition(0);
                            else setPosition(v);
                        }}
                    />
                </Box>
            </DialogContent>

            <DialogActions>
                {zone && (
                    <Button variant="contained" fullWidth size="large" color="error" onClick={handleRemoveZone}>
                        Remover
                    </Button>
                )}

                {zone && (
                    <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        onClick={() => handleCloseModal(true, true)}
                        disabled={!isValid}
                    >
                        Atualizar
                    </Button>
                )}

                {!zone && (
                    <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        onClick={() => handleCloseModal(true, false)}
                        disabled={!isValid}
                    >
                        Adicionar
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

export default ZoneModal;
