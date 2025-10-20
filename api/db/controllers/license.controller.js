import {
    applyLicense,
    clearLicense,
    ensureLicenseState,
    LicenseError
} from '../../services/license.service.js';

export const status = async (req, res) => {
    const state = await ensureLicenseState();
    const {token, ...rest} = state;
    res.json(rest);
};

export const statusDetailed = async (req, res) => {
    const state = await ensureLicenseState();
    res.json(state);
};

export const activate = async (req, res) => {
    try {
        const {code} = req.body || {};
        const state = await applyLicense(code);
        res.json(state);
    } catch (error) {
        if (error instanceof LicenseError) {
            return res.status(400).json({
                message: error.message,
                reason: error.reason,
                valid: false,
            });
        }

        console.error('Falha ao aplicar a licença:', error);
        return res.status(500).json({
            message: 'Não foi possível aplicar o código de licença.',
        });
    }
};

export const remove = async (req, res) => {
    try {
        const state = await clearLicense();
        res.json(state);
    } catch (error) {
        console.error('Falha ao remover a licença:', error);
        res.status(500).json({message: 'Não foi possível remover a licença.'});
    }
};
