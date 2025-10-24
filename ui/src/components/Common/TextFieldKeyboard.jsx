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
import {useVirtualKeyboard} from "../../context/VirtualKeyboardContext.jsx";


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
    const [open, setOpen] = React.useState(false);
    const [shift, setShift] = React.useState(false);
    const [showPwd, setShowPwd] = React.useState(false);
    const inputRef = React.useRef(null);
    const instanceId = React.useId();
    const {
        enabled: virtualKeyboardEnabled,
        acquireKeyboard,
        releaseKeyboard,
    } = useVirtualKeyboard();
    const [anchorRect, setAnchorRect] = React.useState(null);
    const [dragOffset, setDragOffset] = React.useState({x: 0, y: 0});
    const dragStateRef = React.useRef(null);

    const toVirtualRect = React.useCallback(
        (rect) => {
            if (!rect) return null;
            const {width, height, top, left, contextElement} = rect;
            const adjustedLeft = left + dragOffset.x;
            const adjustedTop = top + dragOffset.y;
            return {
                contextElement,
                getBoundingClientRect: () => ({
                    width,
                    height,
                    top: adjustedTop,
                    bottom: adjustedTop + height,
                    left: adjustedLeft,
                    right: adjustedLeft + width,
                    x: adjustedLeft,
                    y: adjustedTop,
                    toJSON: () => ({
                        width,
                        height,
                        top: adjustedTop,
                        left: adjustedLeft,
                    }),
                }),
            };
        },
        [dragOffset],
    );

    const virtualAnchor = React.useMemo(() => toVirtualRect(anchorRect), [anchorRect, toVirtualRect]);

    const stopDrag = React.useCallback(() => {
        const active = dragStateRef.current;
        if (!active) return;
        window.removeEventListener('pointermove', active.onPointerMove);
        window.removeEventListener('pointerup', active.onPointerUp);
        window.removeEventListener('pointercancel', active.onPointerUp);
        if (active.previousUserSelect !== undefined) {
            document.body.style.userSelect = active.previousUserSelect;
        }
        if (active.previousCursor !== undefined) {
            document.body.style.cursor = active.previousCursor;
        }
        dragStateRef.current = null;
    }, []);

    const close = React.useCallback(() => {
        stopDrag();
        setOpen(false);
        setAnchorRect(null);
        setDragOffset({x: 0, y: 0});
        releaseKeyboard(instanceId);
    }, [releaseKeyboard, instanceId, stopDrag]);

    const handleFocus = React.useCallback((e) => {
        const rect = e.currentTarget?.getBoundingClientRect?.();
        if (rect) {
            setAnchorRect({
                width: rect.width,
                height: rect.height,
                top: rect.top,
                left: rect.left,
                contextElement: e.currentTarget,
            });
            setDragOffset({x: 0, y: 0});
        }
        if (!openOnFocus || !virtualKeyboardEnabled) return;
        acquireKeyboard(instanceId, close);
        setOpen(true);
    }, [openOnFocus, virtualKeyboardEnabled, acquireKeyboard, instanceId, close]);

    const handleDragStart = React.useCallback((event) => {
        if (!open || !virtualKeyboardEnabled) return;
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();

        stopDrag();

        const pointerId = event.pointerId ?? 1;
        const startX = event.clientX;
        const startY = event.clientY;
        const origin = {x: dragOffset.x, y: dragOffset.y};

        const previousUserSelect = document.body.style.userSelect;
        const previousCursor = document.body.style.cursor;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';

        const onPointerMove = (moveEvent) => {
            if ((moveEvent.pointerId ?? 1) !== pointerId) return;
            moveEvent.preventDefault();
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            setDragOffset({x: origin.x + dx, y: origin.y + dy});
        };

        const onPointerUp = (upEvent) => {
            if ((upEvent.pointerId ?? 1) !== pointerId) return;
            stopDrag();
        };

        dragStateRef.current = {
            onPointerMove,
            onPointerUp,
            previousUserSelect,
            previousCursor,
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    }, [open, virtualKeyboardEnabled, dragOffset.x, dragOffset.y, stopDrag]);

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

    React.useEffect(() => {
        if (!virtualKeyboardEnabled) {
            close();
        }
    }, [virtualKeyboardEnabled, close]);

    React.useEffect(() => () => {
        stopDrag();
        releaseKeyboard(instanceId);
    }, [instanceId, releaseKeyboard, stopDrag]);

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
                    inputProps: {maxLength: maxLength || textFieldProps?.InputProps?.inputProps?.maxLength},
                    endAdornment: mergedEndAdornment,
                }}
            />

            <Popper
                open={virtualKeyboardEnabled && open && Boolean(virtualAnchor)}
                anchorEl={virtualAnchor}
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
                    <Box
                        onPointerDown={handleDragStart}
                        sx={{
                            cursor: 'grab',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            mb: 1,
                            userSelect: 'none',
                        }}
                    >
                        <Box sx={{width: 72, height: 6, borderRadius: 3, bgcolor: 'text.disabled', opacity: 0.5}}/>
                    </Box>
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
