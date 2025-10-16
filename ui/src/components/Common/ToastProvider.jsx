// useErrorToast.jsx
import React, {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import AlertSnackbar from "./AlertSnackbar";

// Shape of a toast item
// { id, error, title, onRetry, autoHideDuration, anchorOrigin }
const ToastContext = createContext(null);

export function ToastProvider({
                                  children,
                                  defaultTitle = 'Algo correu mal.',
                                  defaultAutoHideDuration = 6000,
                                  keepMounted = true,
                              }) {
    const queueRef = useRef([]);
    const [current, setCurrent] = useState(null);

    const showNext = useCallback(() => {
        const next = queueRef.current.shift() || null;
        setCurrent(next);
    }, []);

    const closeCurrent = useCallback(() => {
        setCurrent(null);
        setTimeout(showNext, 50);
    }, [showNext]);

    const push = useCallback(
        ({type, error, title, onRetry, autoHideDuration, anchorOrigin} = {}) => {
            const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            queueRef.current.push({
                id,
                error,
                type,
                title: title ?? defaultTitle,
                description: error,
                onRetry: onRetry ?? null,
                autoHideDuration: autoHideDuration ?? defaultAutoHideDuration,
                anchorOrigin: anchorOrigin,
            });
            // if nothing being shown, start
            if (!current) showNext();
        },
        [current, defaultTitle, defaultAutoHideDuration, showNext]
    );

    // Convenience helpers
    const pushError = useCallback(
        (error, opts = {}) => push({type: "error", title: "Erro", error: error, ...opts}),
        [push]
    );

    const pushMessage = useCallback(
        (type, message, opts = {}) => push({type: type, title: "Sucesso", error: message, ...opts}),
        [push]
    );

    const pushNetworkError = useCallback(
        (axiosErr, opts = {}) => {
            // extract meaningful info from axios-like error
            const payload =
                axiosErr?.response?.data?.message ||
                axiosErr?.message ||
                'Network request failed';
            push({type: "error", error: payload, ...opts});
        },
        [push]
    );

    const value = useMemo(
        () => ({pushError, pushMessage, pushNetworkError}),
        [pushError, pushMessage, pushNetworkError]
    );

    return (
        <ToastContext.Provider value={value}>
            {children}

            <AlertSnackbar
                open={Boolean(current)}
                type={current?.type || 'error'}
                title={current?.title}
                description={current?.error}
                onClose={closeCurrent}
                onRetry={
                    current?.onRetry
                        ? () => {
                            closeCurrent();
                            setTimeout(() => current.onRetry?.(), 0);
                        }
                        : undefined
                }
                autoHideDuration={current?.autoHideDuration}
                anchorOrigin={current?.anchorOrigin}
                keepMounted={keepMounted}
            />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used within an ToastProvider');
    }
    return ctx;
}
