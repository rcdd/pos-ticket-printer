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
import {CardThemes} from "../../enums/CardThemes";

export default function ImportExportPage() {
    const {pushNetworkError, pushMessage} = useToast();
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
                price: (p.price / 100).toFixed(2),
                zone_name: p.zone?.name ?? "",
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
            {type: "product", name: "Imperial", price: "1.10", zone_name: "Bar", theme: "green", position: 10},
            {type: "product", name: "Bifana", price: "3.50", zone_name: "Cozinha", theme: "orange"},
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

    const validate = (rows, knownZonesByName, knownZonesById, existingProductsByKey) => {
        const issues = [];
        const normalized = [];
        const seenProducts = new Map();

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
            const name = typeof raw.name === "string" ? raw.name.trim() : "";
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
            const priceSource = raw.price ?? raw.price_eur ?? "";
            const pstr = String(priceSource).replace(",", ".");
            const price = Number(pstr);
            if (!Number.isFinite(price) || price < 0) {
                issues.push({row: i + 1, level: "error", msg: "produto: 'price' inválido"});
                continue;
            }

            // theme
            let theme = (raw.theme || "default").toLowerCase();
            if (!Object.keys(CardThemes).includes(theme)) {
                issues.push({row: i + 1, level: "warning", msg: `theme desconhecido '${raw.theme}', a usar 'default'`});
                theme = "default";
            }

            // zona
            let zoneId = raw.zone_id ? parseInt(raw.zone_id, 10) : null; // legacy support
            let zoneName = typeof raw.zone_name === "string" ? raw.zone_name.trim() : null;
            let zoneRecord = null;

            if (zoneId && knownZonesById.has(zoneId)) {
                zoneRecord = knownZonesById.get(zoneId);
                zoneName = zoneRecord?.name ?? zoneName;
            }

            if (!zoneRecord && zoneName) {
                const lookup = knownZonesByName.get(zoneName.toLowerCase());
                if (lookup) {
                    zoneRecord = lookup;
                    zoneId = lookup.id;
                    zoneName = lookup.name;
                }
            }

            if (zoneId && !zoneRecord) {
                issues.push({row: i + 1, level: "error", msg: `zone_id ${zoneId} não existe`});
                continue;
            }

            if (!zoneRecord && zoneName && !createZones) {
                issues.push({
                    row: i + 1,
                    level: "error",
                    msg: `zone_name '${zoneName}' não existe (desliga o erro ativando 'Criar zonas')`
                });
                continue;
            }

            const resolvedZoneName = zoneRecord?.name || zoneName || "";
            const zoneKey = resolvedZoneName.trim().toLowerCase() || "__nozone__";

            const position = raw.position ? parseInt(raw.position, 10) : null;
            const productKey = `${zoneKey}::${name.toLowerCase()}`;

            const existingProduct = existingProductsByKey.get(productKey) || null;
            if (existingProduct) {
                issues.push({
                    row: i + 1,
                    level: "warning",
                    msg: `produto '${name}' na zona '${resolvedZoneName || 'Sem Zona'}' já existe e será atualizado.`
                });
            }

            if (seenProducts.has(productKey)) {
                issues.push({
                    row: i + 1,
                    level: "warning",
                    msg: "produto duplicado no ficheiro; a última entrada prevalece."
                });
            }
            seenProducts.set(productKey, i + 1);

            normalized.push({
                kind: "product",
                id: raw.id || null,
                name,
                price_cents: Math.round(price * 100),
                theme,
                zoneId: zoneRecord?.id ?? zoneId ?? null,
                zoneName: resolvedZoneName,
                position,
                zoneKey,
                existingProductId: existingProduct?.id ?? null
            });
        }
        return {normalized, issues};
    };

    const handleImport = async () => {
        setReport(null);
        try {
            const {data: zones} = await ZoneService.getAll();
            const byName = new Map();
            const byId = new Map();
            (zones || []).forEach((z) => {
                const key = typeof z.name === "string" ? z.name.trim().toLowerCase() : "";
                if (key) {
                    byName.set(key, z);
                }
                if (z.id != null) {
                    byId.set(z.id, z);
                }
            });

            const {data: products} = await ProductService.getAll();
            const productsByKey = new Map();
            const productIdToKey = new Map();
            (products || []).forEach((p) => {
                const zoneNameLower = (p.zone?.name || "").trim().toLowerCase() || "__nozone__";
                const nameLower = typeof p.name === "string" ? p.name.trim().toLowerCase() : "";
                if (!nameLower) return;
                const key = `${zoneNameLower}::${nameLower}`;
                productsByKey.set(key, p);
                if (p.id != null) {
                    productIdToKey.set(p.id, key);
                }
            });

            const {normalized, issues} = validate(rows, byName, byId, productsByKey);
            const hasErrors = issues.some(i => i.level === "error");
            const success = !hasErrors;
            setReport({issues, success});

            if (dryRun) {
                if (success) {
                    pushMessage("success", "Validação concluída sem erros.");
                }
                return;
            }

            if (hasErrors) return;

            if (createZones) {
                const newZonesNeeded = new Map();
                normalized
                    .filter(n => n.kind === "product" && !n.zoneId && n.zoneName)
                    .forEach(n => {
                        const key = n.zoneName.trim().toLowerCase();
                        if (!key) return;
                        if (!byName.has(key) && !newZonesNeeded.has(key)) {
                            newZonesNeeded.set(key, n.zoneName.trim());
                        }
                    });

                for (const [key, originalName] of newZonesNeeded) {
                    const res = await ZoneService.create({name: originalName});
                    const zone = res.data || res;
                    if (zone) {
                        const zoneKey = typeof zone.name === "string" ? zone.name.trim().toLowerCase() : key;
                        if (zoneKey) {
                            byName.set(zoneKey, zone);
                        }
                        if (zone.id != null) {
                            byId.set(zone.id, zone);
                        }
                    }
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
                let zoneIdResolved = p.zoneId;
                if (!zoneIdResolved && p.zoneName) {
                    const lookup = byName.get(p.zoneName.trim().toLowerCase());
                    zoneIdResolved = lookup?.id ?? null;
                }
                const zoneRecord = zoneIdResolved ? byId.get(zoneIdResolved) : null;
                const zoneKey = (zoneRecord?.name || p.zoneName || "").trim().toLowerCase() || "__nozone__";
                const productNameLower = p.name.trim().toLowerCase();

                const payload = {
                    name: p.name,
                    price: p.price_cents,
                    zoneId: zoneIdResolved,
                    theme: p.theme,
                    position: p.position
                };

                const existingId = p.id || p.existingProductId;
                if (existingId) {
                    const previousKey = productIdToKey.get(existingId);
                    await ProductService.update({id: existingId, ...payload});
                    if (previousKey && previousKey !== `${zoneKey}::${productNameLower}`) {
                        productsByKey.delete(previousKey);
                    }
                    productsByKey.set(`${zoneKey}::${productNameLower}`, {
                        id: existingId,
                        zoneId: zoneIdResolved,
                        name: p.name
                    });
                    productIdToKey.set(existingId, `${zoneKey}::${productNameLower}`);
                } else {
                    const res = await ProductService.create(payload);
                    const created = res?.data || res;
                    const newId = created?.id;
                    if (newId) {
                        productsByKey.set(`${zoneKey}::${productNameLower}`, {
                            id: newId,
                            zoneId: zoneIdResolved,
                            name: p.name
                        });
                        productIdToKey.set(newId, `${zoneKey}::${productNameLower}`);
                    }
                }
            }

            setReport(r => ({...(r || {}), done: true, success: true}));
            pushMessage("success", "Importação concluída com sucesso.");
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
                        {report?.success && !report?.done && (
                            <Alert severity="success">Validação concluída sem erros críticos.</Alert>
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
