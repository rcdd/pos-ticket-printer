import React from "react";
import OptionService from "../services/option.service.js";

const VirtualKeyboardContext = React.createContext({
    enabled: true,
    loading: true,
    setEnabled: () => {},
    refresh: async () => {},
});

export function VirtualKeyboardProvider({children}) {
    const [enabled, setEnabledState] = React.useState(true);
    const [loading, setLoading] = React.useState(true);

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

    const contextValue = React.useMemo(() => ({
        enabled,
        loading,
        setEnabled,
        refresh: load,
    }), [enabled, loading, setEnabled, load]);

    return (
        <VirtualKeyboardContext.Provider value={contextValue}>
            {children}
        </VirtualKeyboardContext.Provider>
    );
}

export const useVirtualKeyboard = () => React.useContext(VirtualKeyboardContext);

export default VirtualKeyboardContext;
