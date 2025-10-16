import React, {useEffect, useMemo, useState} from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Stack,
    MenuItem,
    Alert,
    CircularProgress
} from "@mui/material";
import UserService from "../../services/user.service";
import {USER_ROLE_OPTIONS, UserRoles, getRoleLabel} from "../../enums/UserRoles";
import {useToast} from "../Common/ToastProvider";
import TextFieldKeyboard from "../Common/TextFieldKeyboard";

const DEFAULT_FORM = {
    id: null,
    name: "",
    username: "",
    role: UserRoles.WAITER,
    password: "",
};

export default function UserModal({
    open,
    onClose,
    user,
    forceAdmin = false,
    title,
}) {
    const {pushNetworkError, pushMessage} = useToast();
    const [form, setForm] = useState(DEFAULT_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const isEdit = Boolean(user?.id);
    const effectiveTitle = title || (isEdit ? "Editar utilizador" : "Adicionar utilizador");

    useEffect(() => {
        if (open) {
            setForm({
                id: user?.id ?? null,
                name: user?.name ?? "",
                username: user?.username ?? "",
                role: forceAdmin ? UserRoles.ADMIN : (user?.role ?? UserRoles.WAITER),
                password: "",
            });
            setError(null);
        }
    }, [open, user, forceAdmin]);

    const roleOptions = useMemo(() => {
        if (forceAdmin) {
            return [{value: UserRoles.ADMIN, label: getRoleLabel(UserRoles.ADMIN)}];
        }
        return USER_ROLE_OPTIONS;
    }, [forceAdmin]);

    const handleEventField = (field) => (event) => {
        const value = event?.target?.value ?? "";
        setForm((prev) => ({...prev, [field]: value}));
    };
    const handleValueField = (field) => (value) => {
        setForm((prev) => ({...prev, [field]: value ?? ""}));
    };

    const validate = () => {
        if (!form.username.trim()) {
            setError("O nome de utilizador é obrigatório.");
            return false;
        }
        if (!isEdit && !form.password.trim()) {
            setError("Defina uma password inicial.");
            return false;
        }
        if (forceAdmin && form.role !== UserRoles.ADMIN) {
            setForm((prev) => ({...prev, role: UserRoles.ADMIN}));
        }
        setError(null);
        return true;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        setSubmitting(true);
        try {
            const payload = {
                id: form.id,
                name: form.name.trim() || null,
                username: form.username.trim(),
                role: forceAdmin ? UserRoles.ADMIN : form.role,
            };
            if (form.password.trim()) {
                payload.password = form.password;
            }

            if (isEdit) {
                await UserService.update(payload);
                pushMessage("success", "Utilizador atualizado.");
            } else {
                await UserService.create(payload);
                pushMessage("success", "Utilizador criado.");
            }
            onClose(true);
        } catch (err) {
            pushNetworkError(err, {title: "Não foi possível guardar o utilizador"});
            setError(err?.response?.data?.message || "Ocorreu um erro ao guardar.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={(_, reason) => {
                if (submitting) return;
                if (reason === "backdropClick" || reason === "escapeKeyDown") {
                    if (forceAdmin) return;
                }
                onClose(false);
            }}
            fullWidth
            maxWidth="xs"
        >
            <DialogTitle>{effectiveTitle}</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2} sx={{mt: 1}}>
                    {forceAdmin && (
                        <Alert severity="info">
                            É necessário criar um utilizador administrador antes de continuar.
                        </Alert>
                    )}
                    <TextFieldKeyboard
                        value={form.name}
                        onChange={handleValueField("name")}
                        maxLength={64}
                        textFieldProps={{
                            label: "Nome",
                            autoComplete: "name",
                            fullWidth: true
                        }}
                    />
                    <TextFieldKeyboard
                        value={form.username}
                        onChange={handleValueField("username")}
                        maxLength={64}
                        textFieldProps={{
                            label: "Nome de utilizador",
                            autoComplete: "username",
                            required: true,
                            fullWidth: true
                        }}
                    />
                    <TextFieldKeyboard
                        value={form.password}
                        onChange={handleValueField("password")}
                        maxLength={64}
                        onEnter={() => {
                            if (!submitting) handleSubmit();
                        }}
                        showPasswordToggle
                        textFieldProps={{
                            label: "Password",
                            type: "password",
                            autoComplete: isEdit ? "new-password" : "password",
                            required: !isEdit,
                            helperText: isEdit ? "Deixe em branco para manter a password atual." : undefined,
                            fullWidth: true
                        }}
                    />
                    <TextField
                        label="Perfil"
                        value={forceAdmin ? UserRoles.ADMIN : form.role}
                        onChange={handleEventField("role")}
                        select
                        fullWidth
                        disabled={forceAdmin}
                    >
                        {roleOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </TextField>
                    {error && (
                        <Alert severity="error">
                            {error}
                        </Alert>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                {!forceAdmin && (
                    <Button onClick={() => onClose(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                )}
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={submitting}
                >
                    {submitting ? <CircularProgress size={20} color="inherit"/> : (isEdit ? "Guardar" : "Criar")}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
