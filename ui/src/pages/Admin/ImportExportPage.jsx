import React, {useRef, useState} from "react";
import {
    Box, Button, Card, CardContent, CardHeader,
    Stack, Typography, Switch, FormControlLabel, Alert
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import UploadIcon from "@mui/icons-material/Upload";
import ContentPasteSearchIcon from "@mui/icons-material/ContentPasteSearch";
import Papa from "papaparse";
import {useToast} from "../../components/Common/ToastProvider";
import ProductService from "../../services/product.service";
import ZoneService from "../../services/zone.service";

const THEMES = ["default", "blue", "green", "orange", "red"];

export default function ImportExportPage() {
    const {pushNetworkError} = useToast();
    const [rows, setRows] = useState([]);
    const [report, setReport] = useState(null);
    const [createZones, setCreateZones] = useState(true);
    const [dryRun, setDryRun] = useState(true);
    const fileRef = useRef(null);

    const download = (name, rows) => {
        const csv = Papa.unparse(rows, {quotes: true});
        const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportProducts = async () => {
        try {
            const {data} = await ProductService.getAll();
            const out = (data || []).map(p => ({
                type: "product",
                id: p.id,
                name: p.name,
                price_eur: (p.price / 100).toFixed(2),
                zone_name: p.zone?.name ?? "",
                zone_id: p.zoneId ?? "",
                theme: p.theme || "default",
                position: p.position ?? ""
            }));
            download("products.csv", out);
        } catch (e) {
            pushNetworkError(e, {title: "Erro a exportar produtos"});
        }
    };

    const handleExportZones = async () => {
        try {
            const {data} = await ZoneService.getAll();
            const out = (data || []).map(z => ({
                type: "zone",
                id: z.id,
                name: z.name,
                position: z.position ?? ""
            }));
            download("zones.csv", out);
        } catch (e) {
            pushNetworkError(e, {title: "Erro a exportar zonas"});
        }
    };

    const handleZoneDownloadTemplate = () => {
        const sample = [
            {type: "zone", name: "Bar", position: 1},
            {type: "zone", name: "Cozinha", position: 2},
        ];
        download("template_import_zones.csv", sample);
    };
    const handleProductDownloadTemplate = () => {
        const sample = [
            {type: "product", name: "Imperial", price_eur: "1.10", zone_name: "Bar", theme: "green", position: 10},
            {type: "product", name: "Bifana", price_eur: "3.50", zone_name: "Cozinha", theme: "orange"},
        ];
        download("template_import_products.csv", sample);
    };

    // Import
    const parseFile = (file) => {
        setReport(null);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: h => h.trim(),
            transform: v => typeof v === "string" ? v.trim() : v,
            complete: ({data, errors}) => {
                if (errors?.length) {
                    setReport({errors: errors.map(e => `CSV: ${e.message} (row ${e.row})`)});
                }
                setRows(data);
            }
        });
    };

    const validate = (rows, knownZonesByName, knownZonesById) => {
        const issues = [];
        const normalized = [];

        for (let i = 0; i < rows.length; i++) {
            const raw = rows[i];
            const t = (raw.type || "").toLowerCase();
            if (t !== "product" && t !== "zone") {
                issues.push({row: i + 1, level: "error", msg: "type deve ser 'product' ou 'zone'"});
                continue;
            }

            if (t === "zone") {
                const name = raw.name || "";
                if (!name) {
                    issues.push({row: i + 1, level: "error", msg: "zona: 'name' obrigatório"});
                    continue;
                }
                const position = raw.position ? parseInt(raw.position, 10) : null;
                normalized.push({kind: "zone", id: raw.id || null, name, position});
                continue;
            }

            // product
            const name = raw.name || "";
            if (!name) {
                issues.push({row: i + 1, level: "error", msg: "produto: 'name' obrigatório"});
                continue;
            }
            if (name.length > 40) {
                issues.push({
                    row: i + 1,
                    level: "warning",
                    msg: "produto: 'name' demasiado longo, máximo 40 caracteres"
                });
            }

            // price
            const pstr = String(raw.price_eur || "").replace(",", ".");
            const price = Number(pstr);
            if (!Number.isFinite(price) || price < 0) {
                issues.push({row: i + 1, level: "error", msg: "produto: 'price_eur' inválido"});
                continue;
            }

            // theme
            let theme = (raw.theme || "default").toLowerCase();
            if (!THEMES.includes(theme)) {
                issues.push({row: i + 1, level: "warning", msg: `theme desconhecido '${raw.theme}', a usar 'default'`});
                theme = "default";
            }

            // zona
            let zoneId = raw.zone_id ? parseInt(raw.zone_id, 10) : null;
            let zoneName = raw.zone_name || null;

            if (zoneId && !knownZonesById.has(zoneId)) {
                issues.push({row: i + 1, level: "error", msg: `zone_id ${zoneId} não existe`});
                continue;
            }
            if (!zoneId && zoneName) {
                if (!knownZonesByName.has(zoneName) && !createZones) {
                    issues.push({
                        row: i + 1,
                        level: "error",
                        msg: `zone_name '${zoneName}' não existe (desliga o erro ativando 'Criar zonas')`
                    });
                    continue;
                }
            }

            const position = raw.position ? parseInt(raw.position, 10) : null;
            normalized.push({
                kind: "product",
                id: raw.id || null,
                name,
                price_cents: Math.round(price * 100),
                theme,
                zoneId, zoneName,
                position
            });
        }
        return {normalized, issues};
    };

    const handleImport = async () => {
        setReport(null);
        try {
            const {data: zones} = await ZoneService.getAll();
            const byName = new Map((zones || []).map(z => [z.name, z]));
            const byId = new Map((zones || []).map(z => [z.id, z]));

            const {normalized, issues} = validate(rows, byName, byId);
            const hasErrors = issues.some(i => i.level === "error");
            setReport({issues});

            if (dryRun || hasErrors) return;

            if (createZones) {
                const newZones = [...new Set(
                    normalized.filter(n => n.kind === "product" && !n.zoneId && n.zoneName && !byName.has(n.zoneName))
                        .map(n => n.zoneName)
                )];
                for (const name of newZones) {
                    const res = await ZoneService.create({name});
                    byName.set(res.data.name, res.data);
                }
            }

            for (const z of normalized.filter(n => n.kind === "zone")) {
                if (z.id) {
                    await ZoneService.update({id: z.id, name: z.name, position: z.position});
                } else {
                    await ZoneService.create({name: z.name, position: z.position});
                }
            }

            for (const p of normalized.filter(n => n.kind === "product")) {
                const zId = p.zoneId ?? byName.get(p.zoneName || "")?.id ?? null;
                const payload = {name: p.name, price: p.price_cents, zoneId: zId, theme: p.theme, position: p.position};
                if (p.id) await ProductService.update({id: p.id, ...payload});
                else await ProductService.create(payload);
            }

            setReport(r => ({...(r || {}), done: true}));
        } catch (e) {
            pushNetworkError(e, {title: "Falha no import"});
        }
    };

    return (
        <Stack spacing={3}>
            <Typography variant="h4">Importar / Exportar</Typography>

            <Card>
                <CardHeader title="Exportar" subheader="Descarregar dados atuais para CSV"/>
                <CardContent>
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                        <Button startIcon={<DownloadIcon/>} variant="outlined" onClick={handleExportProducts}>
                            Produtos (CSV)
                        </Button>
                        <Button startIcon={<DownloadIcon/>} variant="outlined" onClick={handleExportZones}>
                            Zonas (CSV)
                        </Button>
                    </Stack>
                    <Stack direction="row" spacing={2} mt={2} flexWrap="wrap">
                        <Button startIcon={<ContentPasteSearchIcon/>} variant="text"
                                onClick={handleProductDownloadTemplate}>
                            Template Produtos CSV
                        </Button>
                        <Button startIcon={<ContentPasteSearchIcon/>} variant="text"
                                onClick={handleZoneDownloadTemplate}>
                            Template Zonas CSV
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            <Card>
                <CardHeader title="Importar" subheader="Produtos e zonas a partir de CSV"/>
                <CardContent>
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".csv,text/csv"
                                style={{display: "none"}}
                                onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}
                            />
                            <Button startIcon={<UploadIcon/>} variant="contained"
                                    onClick={() => fileRef.current?.click()}>
                                Escolher CSV
                            </Button>
                            <FormControlLabel
                                control={<Switch checked={dryRun} onChange={(e) => setDryRun(e.target.checked)}/>}
                                label="Dry-run (só validar)"
                            />
                            <FormControlLabel
                                control={<Switch checked={createZones}
                                                 onChange={(e) => setCreateZones(e.target.checked)}/>}
                                label="Criar zonas automaticamente"
                            />
                            <Button variant="outlined" disabled={!rows.length} onClick={handleImport}>
                                {dryRun ? "Validar" : "Importar"}
                            </Button>
                        </Stack>


                        {report?.issues?.length > 0 && (
                            <Stack spacing={1}>
                                {report.issues.map((i, idx) => (
                                    <Alert key={idx} severity={i.level === "error" ? "error" : "warning"}>
                                        Linha {i.row}: {i.msg}
                                    </Alert>
                                ))}
                            </Stack>
                        )}
                        {report?.done && <Alert severity="success">Importação concluída com sucesso.</Alert>}

                        {!!rows.length && (
                            <Typography variant="body2" color="text.secondary">
                                Linhas carregadas: {rows.length}. Mostradas as primeiras 50 abaixo.
                            </Typography>
                        )}

                        {!!rows.length && (
                            <Box sx={{
                                maxHeight: 320,
                                overflow: "auto",
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 1,
                                p: 1
                            }}>
                                <table className="table table-sm" style={{width: "100%", fontSize: 12}}>
                                    <thead>
                                    <tr>
                                        <td>#</td>
                                        {Object.keys(rows[0]).map(h => <th key={h}>{h}</th>)}
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {rows.slice(0, 50).map((r, idx) => (
                                        <tr key={idx}>
                                            <td>{idx + 1}</td>
                                            {Object.keys(rows[0]).map(h => <td key={h}>{r[h]}</td>)}
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </Box>
                        )}
                    </Stack>
                </CardContent>
            </Card>
        </Stack>
    );
}
