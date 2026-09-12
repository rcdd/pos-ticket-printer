import {ensureLicenseState} from "../services/license.service.js";
import {readMultiTerminalSetting} from "../db/controllers/options.controller.js";

export function requireRole(...roles) {
    return (req, res, next) => {
        const role = req.user?.role;
        if (!role) {
            return res.status(401).send({message: "Token ausente."});
        }
        if (!roles.includes(role)) {
            return res.status(403).send({message: "Sem permissões para esta operação."});
        }
        next();
    };
}

export function requireFeature(feature) {
    return async (req, res, next) => {
        try {
            const state = await ensureLicenseState();
            if (!state.valid || !state.features?.[feature]) {
                return res.status(403).send({
                    message: "A licença atual não inclui esta funcionalidade.",
                    feature,
                });
            }

            if (feature === 'multi') {
                const enabled = await readMultiTerminalSetting();
                if (!enabled) {
                    return res.status(403).send({
                        message: "O modo multiposto está desativado nas configurações.",
                        feature,
                    });
                }
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}
