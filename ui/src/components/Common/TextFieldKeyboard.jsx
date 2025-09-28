import React from "react";
import {
    Box,
    Popper,
    Paper,
    IconButton,
    Button,
    Stack,
    TextField,
    Divider,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import BackspaceIcon from "@mui/icons-material/Backspace";
import KeyboardCapslockIcon from "@mui/icons-material/KeyboardCapslock";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardReturnIcon from "@mui/icons-material/KeyboardReturn";


const COLS = 10;

const ROW_NUMBERS = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
];

const ROW_LETTERS_1 = [
    "q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
];

const ROW_LETTERS_2 = [
    "a", "s", "d", "f", "g", "h", "j", "k", "l", "ç",
];

const ROW_LETTERS_3 = [
    {k: "", span: 1}, "z", "x", "c", "v", "b", "n", "m", {k: "", span: 2},
];

const ROW_SYMBOLS = [
    {k: ".", span: 1}, ",", ":", ";", "/", "\\", "(", ")", "[", "]",
];

const ROW_BOTTOM = [
    {k: "@", span: 1}, {k: ".", span: 1}, {k: "space", label: "Espaço", span: 6}, {k: "_", span: 1}, {k: "-", span: 1},
];


function Key({children, onClick, span = 1, sx, ...rest}) {
    return (
        <Button
            variant="outlined"
            onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onClick={onClick}
            sx={{
                gridColumn: `span ${span}`,
                minWidth: 0,
                height: 46,
                fontWeight: 600,
                borderRadius: 1.5,
                textTransform: "none",
                ...sx,
            }}
            {...rest}
        >
            {children}
        </Button>
    );
}

export default function TextFieldKeyboard({
                                              value,
                                              onChange,
                                              onEnter,
                                              openOnFocus = true,
                                              maxLength,
                                              showSymbols = true,
                                              textFieldProps = {},
                                              showPasswordToggle,
                                          }) {
    const [anchorEl, setAnchorEl] = React.useState(null);
    const [open, setOpen] = React.useState(false);
    const [shift, setShift] = React.useState(false);
    const [showPwd, setShowPwd] = React.useState(false);

    const inputRef = React.useRef(null);

    const handleFocus = (e) => {
        setAnchorEl(e.currentTarget);
        if (openOnFocus) setOpen(true);
    };

    const close = () => setOpen(false);

    const typeChar = (ch) => {
        if (maxLength && String(value ?? "").length >= maxLength) return;
        const toAppend = shift ? ch.toUpperCase() : ch;
        onChange?.((String(value ?? "") + toAppend));
    };

    const backspace = () => {
        const s = String(value ?? "");
        onChange?.(s.slice(0, -1));
    };

    const space = () => typeChar(" ");

    const handleEnter = () => {
        onEnter?.(String(value ?? ""));
        close();
    };

    const preventBlurMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const isPassword =
        textFieldProps?.type === "password" || Boolean(showPasswordToggle);

    const mergedEndAdornment = (
        <Box sx={{display: "flex", alignItems: "center", gap: 0.5}}>
            {textFieldProps?.InputProps?.endAdornment}
            {isPassword && (
                <IconButton
                    size="small"
                    edge="end"
                    aria-label={showPwd ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowPwd((v) => !v)}
                >
                    {showPwd ? <VisibilityOff/> : <Visibility/>}
                </IconButton>
            )}
        </Box>
    );

    return (
        <>
            <TextField
                {...textFieldProps}
                inputRef={inputRef}
                value={value ?? ""}
                type={isPassword ? (showPwd ? "text" : "password") : textFieldProps?.type}
                onFocus={handleFocus}
                onChange={(e) => onChange?.(e.target.value)}
                InputProps={{
                    ...(textFieldProps?.InputProps || {}),
                    endAdornment: mergedEndAdornment,
                }}
            />

            <Popper
                open={open}
                anchorEl={anchorEl}
                placement="bottom-start"
                modifiers={[{name: "offset", options: {offset: [0, 8]}}]}
                sx={{zIndex: (t) => t.zIndex.modal + 1}}
            >
                <Paper
                    elevation={6}
                    onMouseDown={preventBlurMouseDown}
                    sx={{
                        p: 1.25,
                        borderRadius: 2,
                        width: {xs: 420, md: 520},
                        userSelect: "none",
                        bgcolor: "background.paper",
                    }}
                >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{mb: 1}}>
                        <Stack direction="row" spacing={0.5}>
                            <Key onClick={() => setShift(s => !s)} sx={{px: 1.5}}>
                                <KeyboardCapslockIcon fontSize="small"/>
                            </Key>
                            <Key onClick={backspace} sx={{px: 1.5}}>
                                <BackspaceIcon fontSize="small"/>
                            </Key>
                        </Stack>
                        <Stack direction="row" spacing={0.5}>
                            <Key color="success" variant="contained" onClick={handleEnter} sx={{px: 2}}>
                                <KeyboardReturnIcon sx={{mr: 0.5}} fontSize="small"/> OK
                            </Key>
                            <Key color="inherit" onClick={close} sx={{px: 1.5}}>
                                <CloseIcon fontSize="small"/>
                            </Key>
                        </Stack>
                    </Stack>

                    <Divider sx={{mb: 1}}/>

                    {showSymbols &&
                        <Box sx={{display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 0.5, mb: 0.5}}>
                            {ROW_SYMBOLS.map((item, idx) => {
                                if (typeof item === "object" && !item.k)
                                    return <Box key={idx} sx={{gridColumn: `span ${item.span}`}}/>;
                                const key = typeof item === "object" ? item.k : item;
                                const span = typeof item === "object" ? item.span : 1;
                                return <Key key={idx} span={span} onClick={() => typeChar(key)}>{key}</Key>;
                            })}
                        </Box>
                    }

                    {ROW_NUMBERS.map((row, i) => (
                        <Box
                            key={`num-${i}`}
                            sx={{
                                display: "grid",
                                gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                                gap: 0.5,
                                mb: 0.5,
                            }}
                        >
                            {row.map((k, idx) => (
                                <Key key={idx} onClick={() => typeChar(k)}>{k}</Key>
                            ))}
                        </Box>
                    ))}

                    <Box sx={{display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 0.5, mb: 0.5}}>
                        {ROW_LETTERS_1.map((item, idx) => {
                            const isObj = typeof item === "object";
                            if (isObj && !item.k) return <Box key={idx} sx={{gridColumn: `span ${item.span}`}}/>;
                            const key = isObj ? item.k : item;
                            const span = isObj?.span || 1;
                            const label = shift ? key.toUpperCase() : key;
                            return <Key key={idx} span={span} onClick={() => typeChar(key)}>{label}</Key>;
                        })}
                    </Box>

                    <Box sx={{display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 0.5, mb: 0.5}}>
                        {ROW_LETTERS_2.map((item, idx) => {
                            const isObj = typeof item === "object";
                            if (isObj && !item.k) return <Box key={idx} sx={{gridColumn: `span ${item.span}`}}/>;
                            const key = isObj ? item.k : item;
                            const span = isObj?.span || 1;
                            const label = shift ? key.toUpperCase() : key;
                            return <Key key={idx} span={span} onClick={() => typeChar(key)}>{label}</Key>;
                        })}
                    </Box>

                    <Box sx={{display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 0.5, mb: 0.5}}>
                        {ROW_LETTERS_3.map((item, idx) => {
                            const isObj = typeof item === "object";
                            if (isObj && !item.k) return <Box key={idx} sx={{gridColumn: `span ${item.span}`}}/>;
                            const key = isObj ? item.k : item;
                            const span = isObj?.span || 1;
                            const label = shift ? key.toUpperCase() : key;
                            return <Key key={idx} span={span} onClick={() => typeChar(key)}>{label}</Key>;
                        })}
                    </Box>

                    <Box sx={{display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 0.5}}>
                        {ROW_BOTTOM.map((item, idx) => {
                            const {k, label, span} = item;
                            if (k === "space") return (
                                <Key key={idx} span={span} onClick={space} sx={{fontWeight: 700}}>
                                    {label || "Espaço"}
                                </Key>
                            );
                            return <Key key={idx} span={span} onClick={() => typeChar(k)}>{k}</Key>;
                        })}
                    </Box>
                </Paper>
            </Popper>
        </>
    );
}
