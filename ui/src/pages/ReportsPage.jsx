import React, {useEffect} from 'react'
import InvoiceService from "../services/invoice.service";
import {
    DataGrid,
    GridCsvExportMenuItem,
    GridPrintExportMenuItem,
    GridToolbarExportContainer
} from '@mui/x-data-grid';
import Button from "@mui/material/Button";
import {Box, Modal} from "@mui/material";
import VisibilityIcon from '@mui/icons-material/Visibility';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

function ReportsPage() {
    const [invoices, setInvoices] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [openModal, setOpenModel] = React.useState(false);
    const [openDialog, setOpenDialog] = React.useState(false);
    const [selectedInvoice, setSelectedInvoice] = React.useState(null);

    const getInvoices = async () => {
        await InvoiceService.getInvoices().then((invoices) => {
            setInvoices(invoices);
        });
    }

    useEffect(() => {
        getInvoices().then(() => {
            setIsLoading(false);
        });
    }, []);

    const dateFormatter = (value) =>
        new Date(value).toLocaleDateString('pt-Pt', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

    const showProducts = (params) => {
        const onClick = () => {
            setSelectedInvoice(params.row);
            setOpenModel(true);
        };

        return (
            <Button onClick={onClick}><VisibilityIcon/></Button>
        );
    }

    const handleCloseModal = () => {
        setOpenModel(false);
        setSelectedInvoice(null);
    }

    const handleCloseDialog = (toDelete = false) => {
        if (toDelete === true) {
            InvoiceService.revokeInvoice(selectedInvoice.id).then(() => {
                getInvoices();
            });
            setOpenModel(false);
            setSelectedInvoice(null);
        }
        setOpenDialog(false);
    }

    const getProduct = (item) => {
        if (item.productItem) {
            return item.productItem;
        }

        return null;
    }

    const getMenu = (item) => {
        if (item.menuItem) {
            return item.menuItem;
        }
        return null;
    }

    const getProductName = (value, item) => {
        if (item.productItem) {
            return item.productItem.name + (item.productItem.isDeleted ? " (Eliminado)" : "");
        }
        if (item.menuItem) {
            return item.menuItem.name + " [Menu]" + (item.menuItem.isDeleted ? " (Eliminado)" : "");
        }

        return '(Desconhecido eliminado)';
    }

    const totalLineGetter = (value, item) => {
        const product = getProduct(item) ?? getMenu(item);
        const price = product ? (product.price / 100) : 0;
        return `${(price * item.quantity).toFixed(2)} €`;
    }

    const getProductPrice = (value, item) => {
        const product = getProduct(item) ?? getMenu(item);
        const price = product ? (product.price / 100) : 0;
        return `${(price).toFixed(2)} €`;
    }

    const revokeInvoice = () => {
        setOpenDialog(true);
    }

    const columnsModal = [
        {field: 'id', headerName: 'Produto', flex: 1, valueGetter: getProductName},
        {field: 'quantity', headerName: 'Quantidade', width: 150},
        {field: 'price', headerName: 'Preço (un)', width: 150, valueGetter: getProductPrice},
        {field: 'total', headerName: 'Total', width: 200, valueGetter: totalLineGetter}
    ];

    const columns = [
        {field: 'id', headerName: 'Id', width: 100},
        {field: 'createdAt', headerName: 'Data', flex: 1, minWidth: 200, valueFormatter: dateFormatter},
        {field: 'total', headerName: 'Total', width: 150, valueGetter: (value) => `${value}€`},
        {field: 'isDeleted', type: 'boolean', headerName: 'Anulado', width: 100},
        {field: 'action', type: 'actions', headerName: 'Ver Fatura', width: 150, renderCell: showProducts},
    ];

    const style = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'calc(100% - 256px)',
        bgcolor: 'background.paper',
        border: '2px solid #000',
        boxShadow: 24,
        p: 4,
    };

    const CustomToolbar = ({csvOptions, printOptions, ...other}) => (
        <div style={{display: 'flex', justifyContent: 'end', width: '100%'}}>
            <GridToolbarExportContainer>
                <GridPrintExportMenuItem options={printOptions}/>
                <GridCsvExportMenuItem options={csvOptions}/>
            </GridToolbarExportContainer>
        </div>
    );

    return (
        <div>
            <h1 className={"mb-4"}>Movimentos</h1>
            <div style={{display: 'flex', flexDirection: 'column', width: '100%'}}>
                <DataGrid
                    rows={invoices}
                    columns={columns}
                    loading={isLoading}
                    localeText={{
                        toolbarExport: "Exportar",
                        toolbarExportCSV: "Descarregar CSV",
                        toolbarExportPrint: "Imprimir",
                    }}
                    slots={{toolbar: CustomToolbar}}
                    initialState={{
                        sorting: {
                            sortModel: [{field: 'id', sort: 'desc'}],
                        },
                    }}
                />
            </div>

            <Modal
                open={openModal}
                onClose={handleCloseModal}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >
                {selectedInvoice ? <Box sx={style}>
                    <h1 className={"p-3"}>
                        Fatura nº {selectedInvoice.id}{selectedInvoice.isDeleted && <span> -
                        <span style={{color: "red"}}> ANULADO</span></span>}
                    </h1>
                    <div style={{display: 'flex', flexDirection: 'column', width: '100%'}}>
                        <DataGrid rows={selectedInvoice.records} columns={columnsModal} loading={isLoading}/>
                    </div>
                    <h4 style={{display: "flex", justifyContent: "end"}}
                        className={"p-4"}>Total: {selectedInvoice.total}€</h4>

                    <div style={{display: "flex", justifyContent: "end"}}
                         className={"mt-4"}>
                        {!selectedInvoice.isDeleted &&
                            <Button style={{marginRight: "auto"}}
                                    variant="contained"
                                    color="error"
                                    onClick={revokeInvoice}>Anular Fatura</Button>}

                        <Button variant="contained"
                                onClick={handleCloseModal}>Close</Button>
                    </div>
                </Box> : <div></div>}
            </Modal>
            <Dialog
                open={openDialog}
                onClose={handleCloseDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    {"Tem a certeza que deseja anular a fatura?\n"}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        Esta ação é irreversível e não pode ser anulada.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Não</Button>
                    <Button onClick={() => handleCloseDialog(true)} autoFocus>
                        Sim
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    )
}

export default ReportsPage
