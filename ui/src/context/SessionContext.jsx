import React from "react";

const SessionContext = React.createContext({
    session: null,
    setSession: () => {},
    refreshSession: async () => {},
    loading: false,
});

export function SessionProvider({value, children}) {
    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    return React.useContext(SessionContext);
}

export default SessionContext;
