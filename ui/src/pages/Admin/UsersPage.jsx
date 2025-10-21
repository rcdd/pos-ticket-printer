import React, {useCallback, useEffect, useMemo, useState} from "react";
import {
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    CircularProgress,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import UserService from "../../services/user.service";
import UserModal from "../../components/Admin/UserModal";
import {getRoleLabel} from "../../enums/UserRoles";
import {useToast} from "../../components/Common/ToastProvider";

export default function UsersPage() {
    const {pushNetworkError, pushMessage} = useToast();
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [deleteDialog, setDeleteDialog] = useState({open: false, user: null});

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await UserService.getAll();
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            pushNetworkError(err, {title: "Não foi possível obter a lista de utilizadores"});
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [pushNetworkError]);

    const fetchCurrentUser = useCallback(async () => {
        try {
            const {data} = await UserService.getCurrent();
            setCurrentUser(data);
        } catch {
            setCurrentUser(null);
        }
    }, []);

    useEffect(() => {
        loadUsers();
        fetchCurrentUser();
    }, [loadUsers, fetchCurrentUser]);

    const handleAdd = () => {
        setSelectedUser(null);
        setModalOpen(true);
    };

    const handleEdit = (user) => {
        setSelectedUser(user);
        setModalOpen(true);
    };

    const handleCloseModal = async (shouldReload) => {
        setModalOpen(false);
        setSelectedUser(null);
        if (shouldReload) {
            await loadUsers();
        }
    };

    const confirmDelete = (user) => {
        setDeleteDialog({open: true, user});
    };

    const cancelDelete = () => {
        setDeleteDialog({open: false, user: null});
    };

    const handleDelete = async () => {
        if (!deleteDialog.user) return;
        try {
            await UserService.delete(deleteDialog.user.id);
            pushMessage("success", "Utilizador removido.");
            await loadUsers();
        } catch (err) {
            pushNetworkError(err, {title: "Não foi possível remover o utilizador"});
        } finally {
            cancelDelete();
        }
    };

    const sortedUsers = useMemo(() => {
        return [...users].sort((a, b) => a.username.localeCompare(b.username, undefined, {sensitivity: "base"}));
    }, [users]);

    return (
        <Box sx={{p: 2}}>
            <Card>
                <CardHeader
                    title="Utilizadores"
                    subheader="Crie, atualize ou remova contas de acesso ao sistema."
                    action={
                        <Button
                            variant="contained"
                            startIcon={<AddIcon/>}
                            onClick={handleAdd}
                        >
                            Adicionar
                        </Button>
                    }
                />
                <CardContent>
                    {loading ? (
                        <Stack alignItems="center" spacing={2} sx={{py: 6}}>
                            <CircularProgress/>
                            <Typography variant="body2" color="text.secondary">
                                A carregar utilizadores...
                            </Typography>
                        </Stack>
                    ) : sortedUsers.length === 0 ? (
                        <Stack alignItems="center" spacing={2} sx={{py: 6}}>
                            <Typography variant="h6">Não existem utilizadores registados.</Typography>
                            <Button variant="contained" onClick={handleAdd} startIcon={<AddIcon/>}>
                                Criar primeiro utilizador
                            </Button>
                        </Stack>
                    ) : (
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Nome</TableCell>
                                    <TableCell>Utilizador</TableCell>
                                    <TableCell>Perfil</TableCell>
                                    <TableCell align="right">Ações</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sortedUsers.map((user) => (
                                    <TableRow key={user.id} hover>
                                        <TableCell>{user.name || "—"}</TableCell>
                                        <TableCell>{user.username}</TableCell>
                                        <TableCell>{getRoleLabel(user.role)}</TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <Tooltip title="Editar">
                                                    <IconButton size="small" onClick={() => handleEdit(user)}>
                                                        <EditIcon fontSize="small"/>
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Remover">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => confirmDelete(user)}
                                                        disabled={currentUser && currentUser.id === user.id}
                                                    >
                                                        <DeleteIcon fontSize="small"/>
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <UserModal
                open={modalOpen}
                onClose={handleCloseModal}
                user={selectedUser}
            />

            <Dialog open={deleteDialog.open} onClose={cancelDelete}>
                <DialogTitle>Remover utilizador</DialogTitle>
                <DialogContent dividers>
                    <Typography>
                        Tem a certeza que pretende remover o utilizador{" "}
                        <strong>{deleteDialog.user?.username}</strong>? Esta ação é irreversível.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={cancelDelete}>Cancelar</Button>
                    <Button onClick={handleDelete} color="error" variant="contained">
                        Remover
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
