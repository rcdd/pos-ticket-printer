import React from "react";
import OptionService from "../services/option.service.js";

const VirtualKeyboardContext = React.createContext({
    enabled: true,
    loading: true,
    setEnabled: () => {},
    refresh: async () => {},
    acquireKeyboard: () => {},
    releaseKeyboard: () => {},
});

export function VirtualKeyboardProvider({children}) {
    const [enabled, setEnabledState] = React.useState(true);
    const [loading, setLoading] = React.useState(true);
    const instancesRef = React.useRef(new Map());

    const load = React.useCallback(async () => {
        setLoading(true);
        try {
            const {data} = await OptionService.getVirtualKeyboard();
            setEnabledState(Boolean(data?.enabled ?? true));
        } catch (error) {
            if (error?.response?.status !== 401) {
                console.error("Não foi possível carregar a configuração do teclado virtual:", error?.response || error);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        load();
    }, [load]);

    const setEnabled = React.useCallback((value) => {
        setEnabledState(Boolean(value));
    }, []);

    const releaseKeyboard = React.useCallback((id) => {
        if (!id) return;
        instancesRef.current.delete(id);
    }, []);

    const acquireKeyboard = React.useCallback((id, closeHandler) => {
        if (!id) return;
        const entries = Array.from(instancesRef.current.entries());
        for (const [key, handler] of entries) {
            if (key === id) continue;
            instancesRef.current.delete(key);
            try {
                handler?.();
            } catch (error) {
                console.error("Falha ao fechar teclado virtual ativo:", error);
            }
        }
        instancesRef.current.set(id, closeHandler);
    }, []);

    const contextValue = React.useMemo(() => ({
        enabled,
        loading,
        setEnabled,
        refresh: load,
        acquireKeyboard,
        releaseKeyboard,
    }), [enabled, loading, setEnabled, load, acquireKeyboard, releaseKeyboard]);

    return (
        <VirtualKeyboardContext.Provider value={contextValue}>
            {children}
        </VirtualKeyboardContext.Provider>
    );
}

export const useVirtualKeyboard = () => React.useContext(VirtualKeyboardContext);

export default VirtualKeyboardContext;
