import React from 'react';
import {TextField} from '@mui/material';
import {NumericKeypad} from './NumericKeypad';

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

    const normalize = (s) => String(s ?? '').replace(',', '.');

    const handleFocus = () => setOpen(true);

    React.useEffect(() => {
        if (!open) return;

        const isInside = (el) => {
            const a = inputRef.current;
            const k = keypadRef.current;
            return !!(el && (a?.contains(el) || k?.contains(el)));
        };

        const onPointer = (e) => {
            const target = e.target;
            if (!isInside(target)) setOpen(false);
        };

        const onFocusIn = (e) => {
            const target = e.target;
            if (!isInside(target)) setOpen(false);
        };

        document.addEventListener('mousedown', onPointer, true);
        document.addEventListener('touchstart', onPointer, true);
        document.addEventListener('focusin', onFocusIn, true);

        return () => {
            document.removeEventListener('mousedown', onPointer, true);
            document.removeEventListener('touchstart', onPointer, true);
            document.removeEventListener('focusin', onFocusIn, true);
        };
    }, [open]);

    const applyKey = (k) => {
        if (k === 'OK') {
            setOpen(false);
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
            setOpen(false);
            onEnter?.(value);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
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
                open={open}
                anchorEl={inputRef.current}
                onKeyPress={applyKey}
                placement={placement}
                decimal={decimal}
            />
        </>
    );
}
