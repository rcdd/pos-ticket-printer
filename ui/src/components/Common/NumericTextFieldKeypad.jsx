import React from 'react';
import {TextField} from '@mui/material';
import {NumericKeypad} from './NumericKeypad';
import {useVirtualKeyboard} from "../../context/VirtualKeyboardContext.jsx";

export default function NumericTextFieldWithKeypad({
                                                       value,
                                                       onChange,
                                                       onEnter,
                                                       decimal = false,
                                                       allowNegative = false,
                                                       maxLength,
                                                       textFieldProps = {},
                                                       placement = 'bottom-start',
                                                   }) {
    const inputRef = React.useRef(null);
    const keypadRef = React.useRef(null);
    const [open, setOpen] = React.useState(false);
    const instanceId = React.useId();
    const {
        enabled: virtualKeyboardEnabled,
        acquireKeyboard,
        releaseKeyboard,
    } = useVirtualKeyboard();
    const [anchorRect, setAnchorRect] = React.useState(null);
    const [dragOffset, setDragOffset] = React.useState({x: 0, y: 0});
    const dragStateRef = React.useRef(null);

    const normalize = (s) => String(s ?? '').replace(',', '.');

    const toVirtualAnchor = React.useCallback(
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

    const virtualAnchor = React.useMemo(() => toVirtualAnchor(anchorRect), [anchorRect, toVirtualAnchor]);

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

    const handleFocus = React.useCallback(() => {
        if (!virtualKeyboardEnabled) return;
        const rect = inputRef.current?.getBoundingClientRect?.();
        if (rect) {
            setAnchorRect({
                width: rect.width,
                height: rect.height,
                top: rect.top,
                left: rect.left,
                contextElement: inputRef.current,
            });
            setDragOffset({x: 0, y: 0});
        }
        acquireKeyboard(instanceId, close);
        setOpen(true);
    }, [virtualKeyboardEnabled, acquireKeyboard, instanceId, close]);

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

    React.useEffect(() => {
        if (!virtualKeyboardEnabled) {
            close();
        }
    }, [virtualKeyboardEnabled, close]);

    React.useEffect(() => {
        if (!open || !virtualKeyboardEnabled) return;

        const isInside = (el) => {
            const a = inputRef.current;
            const k = keypadRef.current;
            return !!(el && (a?.contains(el) || k?.contains(el)));
        };

        const onPointer = (e) => {
            const target = e.target;
            if (!isInside(target)) close();
        };

        const onFocusIn = (e) => {
            const target = e.target;
            if (!isInside(target)) close();
        };

        document.addEventListener('mousedown', onPointer, true);
        document.addEventListener('touchstart', onPointer, true);
        document.addEventListener('focusin', onFocusIn, true);

        return () => {
            document.removeEventListener('mousedown', onPointer, true);
            document.removeEventListener('touchstart', onPointer, true);
            document.removeEventListener('focusin', onFocusIn, true);
        };
    }, [open, virtualKeyboardEnabled, close]);

    React.useEffect(() => () => {
        stopDrag();
        releaseKeyboard(instanceId);
    }, [instanceId, releaseKeyboard, stopDrag]);

    const applyKey = (k) => {
        if (k === 'OK') {
            close();
            onEnter?.(value);
            return;
        }
        if (k === 'CLEAR') {
            onChange?.('');
            return;
        }
        if (k === 'BACK') {
            onChange?.(String(value ?? '').slice(0, -1));
            return;
        }

        let next = String(value ?? '');
        if (k === '.' || k === ',') {
            if (!decimal) return;
            if (normalize(next).includes('.')) return; // só um separador
            next += ',';
        } else if (k === '-' && allowNegative) {
            next = next.startsWith('-') ? next.slice(1) : '-' + next;
        } else {
            if (maxLength && next.replace('-', '').length >= maxLength) return;
            next += k;
        }
        onChange?.(next);
    };

    const handleNativeChange = (e) => {
        let v = e.target.value ?? '';
        v = v.replace(/[.]/g, ',');
        const regexWithDecimal = allowNegative ? /^-?\d*(,\d*)?$/ : /^\d*(,\d*)?$/;
        const regexWithoutDecimal = allowNegative ? /^-?\d*$/ : /^\d*$/;
        const regex = decimal ? regexWithDecimal : regexWithoutDecimal;

        if (maxLength && v.replace('-', '').length > maxLength) return;

        if (v === '' || regex.test(v)) {
            onChange?.(v);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            close();
            onEnter?.(value);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
        }
    };

    return (
        <>
            <TextField
                {...textFieldProps}
                inputRef={inputRef}
                value={value ?? ''}
                onFocus={handleFocus}
                onChange={handleNativeChange}
                onKeyDown={handleKeyDown}
                inputMode="decimal"
                autoComplete="off"
            />

            <NumericKeypad
                ref={keypadRef}
                open={virtualKeyboardEnabled && open && Boolean(virtualAnchor)}
                anchorEl={virtualAnchor}
                onKeyPress={applyKey}
                placement={placement}
                decimal={decimal}
                onDragHandlePointerDown={handleDragStart}
            />
        </>
    );
}
