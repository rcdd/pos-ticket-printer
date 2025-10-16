import React from "react";
import UserModal from "./UserModal";

export default function InitialUserSetup({open, onCompleted}) {
    return (
        <UserModal
            open={open}
            onClose={(saved) => {
                if (saved) {
                    onCompleted();
                }
            }}
            forceAdmin
            title="Criar administrador"
        />
    );
}
