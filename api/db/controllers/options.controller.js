import db from "../index.js";
const Option = db.options;

const optionPrintName = 'printer';
const optionFirstLine = 'firstLine';
const optionSecondLine = 'secondLine';
const optionPrintType = 'printOptionType';
const optionOpenDrawer = 'openDrawer';
const optionOnboarding = 'onboarding_completed';
const optionVirtualKeyboard = 'virtual_keyboard_enabled';
const optionFavorites = 'pos_favorites_enabled';
const optionFavoritesCount = 'pos_favorites_count';

export const readOnboardingStatus = async () => {
    const existing = await Option.findOne({where: {name: optionOnboarding}});
    return String(existing?.value ?? 'false').toLowerCase() === 'true';
};

export const setOnboardingStatus = async (completed) => {
    const value = completed ? 'true' : 'false';
    const existing = await Option.findOne({where: {name: optionOnboarding}});
    if (existing) {
        await existing.update({value});
    } else {
        await Option.create({name: optionOnboarding, value});
    }
};

const parseBoolean = (value, fallback = true) => {
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
};

export const readVirtualKeyboardSetting = async () => {
    const rows = await Option.findAll({where: {name: optionVirtualKeyboard}});
    if (rows.length > 1) {
        const [primary, ...duplicates] = rows;
        if (duplicates.length > 0) {
            await Option.destroy({where: {id: duplicates.map((row) => row.id)}});
        }
        return parseBoolean(primary?.value, true);
    }
    const row = rows[0] || null;
    return parseBoolean(row?.value, true);
};

export const writeVirtualKeyboardSetting = async (enabled) => {
    const value = enabled ? 'true' : 'false';
    const rows = await Option.findAll({where: {name: optionVirtualKeyboard}});
    if (rows.length > 0) {
        const [primary, ...duplicates] = rows;
        await primary.update({value});
        if (duplicates.length > 0) {
            await Option.destroy({where: {id: duplicates.map((row) => row.id)}});
        }
        return enabled;
    }
    await Option.create({name: optionVirtualKeyboard, value});
    return enabled;
};

export const getVirtualKeyboard = async (req, res) => {
    try {
        const enabled = await readVirtualKeyboardSetting();
        res.send({enabled});
    } catch (error) {
        console.error('Error reading virtual keyboard setting:', error);
        res.status(500).send({
            message: "Não foi possível obter a configuração do teclado virtual.",
            error: error?.message || error,
        });
    }
};

export const setVirtualKeyboard = async (req, res) => {
    try {
        const {enabled} = req.body ?? {};
        const parsed = parseBoolean(enabled, null);
        if (parsed === null) {
            return res.status(400).send({
                message: "O campo 'enabled' é obrigatório e deve ser verdadeiro ou falso.",
            });
        }
        const updated = await writeVirtualKeyboardSetting(parsed);
        res.send({enabled: updated});
    } catch (error) {
        console.error('Error saving virtual keyboard setting:', error);
        res.status(500).send({
            message: "Não foi possível guardar a configuração do teclado virtual.",
            error: error?.message || error,
        });
    }
};

export const getPrinter = (req, res) => {
    Option.findOne({
        where: {
            name: optionPrintName
        }
    })
        .then(data => {
            if (data) {
                res.send({name: data.value});
            } else {
                res.send({name: null});
            }
        })
        .catch(() => {
            res.status(500).send({
                message: "Error retrieving printer"
            });
        });
}

export const setPrinter = async (req, res) => {
    // Validate request
    if (!req.body.name) {
        res.status(400).send({
            message: "Name can not be empty!"
        });
        return;
    }

    const name = req.body.name;

    Option.findOne({
        where: {
            name: optionPrintName
        }
    }).then(data => {
        if (data) {
            Option.update({value: name}, {
                where: {name: optionPrintName}
            })
                .then(num => {
                    if (num.includes(1)) {
                        res.send({
                            message: "Printer was updated successfully."
                        });
                    } else {
                        res.send({
                            message: `Cannot update printer with name=${name}. Maybe printer was not found or req.body is empty!`
                        });
                    }
                })
                .catch(err => {
                    res.status(500).send({
                        message: "Error updating printer with name=" + name,
                        error: err
                    });
                });

            return;
        }

        // Save Option in the database
        Option.create({name: optionPrintName, value: req.body.name})
            .then(data => {
                res.send({name: data.value});
            })
            .catch(err => {
                res.status(500).send({
                    message:
                        err.message || "Some error occurred while creating the Product."
                });
            });
    });
};

export const setHeaderFirstLine = (req, res) => {
    // Validate request
    if (!req.body.firstLine) {
        res.status(400).send({
            message: "First line can not be empty!"
        });
        return;
    }

    const firstLine = req.body.firstLine;

    Option.findOne({
        where: {
            name: optionFirstLine
        }
    }).then(data => {
        if (data) {
            Option.update({value: firstLine}, {
                where: {name: optionFirstLine}
            })
                .then(num => {
                    if (num.includes(1)) {
                        res.send({
                            message: "First line was updated successfully."
                        });
                    } else {
                        res.send({
                            message: `Cannot update first line with ${firstLine}!`
                        });
                    }
                })
                .catch(err => {
                    res.status(500).send({
                        message: "Error updating first line with " + firstLine,
                        error: err
                    });
                });

            return;
        }

        // Save Option in the database
        Option.create({name: optionFirstLine, value: firstLine})
            .then(data => {
                res.send({text: data.value});
            })
            .catch(err => {
                res.status(500).send({
                    message:
                        err.message || "Some error occurred while creating the item."
                });
            });
    });
}

export const setHeaderSecondLine = (req, res) => {
    const secondLine = req.body.secondLine || '';

    Option.findOne({
        where: {
            name: optionSecondLine
        }
    }).then(data => {
        if (data) {
            Option.update({value: secondLine}, {
                where: {name: optionSecondLine}
            })
                .then(num => {
                    if (num.includes(1)) {
                        res.send({
                            message: "Second line was updated successfully."
                        });
                    } else {
                        res.send({
                            message: `Cannot update second line with ${secondLine}!`
                        });
                    }
                })
                .catch(err => {
                    res.status(500).send({
                        message: "Error updating second line with " + secondLine,
                        error: err
                    });
                });

            return;
        }

        Option.create({name: optionSecondLine, value: secondLine})
            .then(data => {
                res.send({text: data.value});
            })
            .catch(err => {
                res.status(500).send({
                    message:
                        err.message || "Some error occurred while creating the item."
                });
            });
    });
}

export const setTypePrint = (req, res) => {
    // Validate request
    if (!req.body.printType) {
        res.status(400).send({
            message: "Option must be defined!"
        });
        return;
    }

    const printOptionTypeValue = req.body.printType;

    if (printOptionTypeValue !== 'totals' && printOptionTypeValue !== 'tickets' && printOptionTypeValue !== 'both') {
        res.status(400).send({
            message: "Invalid print totals option! Must be 'totals', 'tickets' or 'both'."
        });
        return;
    }

    Option.findOne({
        where: {
            name: optionPrintType
        }
    }).then(data => {
        if (data) {
            Option.update({value: printOptionTypeValue}, {
                where: {name: optionPrintType}
            })
                .then(num => {
                    if (num.includes(1)) {
                        res.send({
                            message: "Print Totals options was updated successfully."
                        });
                    } else {
                        res.send({
                            message: `Cannot update print totals. Value: ${printOptionTypeValue}!`
                        });
                    }
                })
                .catch(err => {
                    res.status(500).send({
                        message: "Error updating print totals value with " + printOptionTypeValue,
                        error: err
                    });
                });

            return;
        }

        Option.create({name: optionPrintType, value: printOptionTypeValue})
            .then(data => {
                res.send({text: data.value});
            })
            .catch(err => {
                res.status(500).send({
                    message:
                        err.message || "Some error occurred while creating the option."
                });
            });
    });
}

export const getHeaders = (req, res) => {
    return Option.findOne({
        where: {
            name: optionFirstLine
        }
    })
        .then(_first => {
            if (_first) {
                return Option.findOne({
                    where: {
                        name: optionSecondLine
                    }
                })
                    .then(_second => {
                        if (_second) {
                            res.send({firstLine: _first.value, secondLine: _second.value});
                        } else {
                            res.send({firstLine: _first.value, secondLine: null});
                        }
                    })
                    .catch(() => {
                        res.status(500).send({
                            message: "Error retrieving header"
                        });
                    });
            } else {
                res.send({firstLine: null, secondLine: null});
            }
        })
        .catch(() => {
            res.status(500).send({
                message: "Error retrieving header"
            });
        });
}

export const getPrintType = (req, res) => {
    return Option.findOne({
        where: {
            name: optionPrintType
        }
    })
        .then(value => {
            if (value) {
                res.send(value.value);
            } else {
                res.send('totals');
            }
        })
        .catch(err => {
            res.status(500).send({
                message: "Error retrieving option: " + err.message
            });
        });
}

export const setOpenDrawer = (req, res) => {
    // Validate request
    if (req.body.openDrawer === undefined || req.body.openDrawer === null) {
        res.status(400).send({
            message: "Option must be defined!"
        });
        return;
    }

    const openDrawerValue = req.body.openDrawer;

    if (openDrawerValue !== 'true' && openDrawerValue !== 'false' && openDrawerValue !== true && openDrawerValue !== false) {
        res.status(400).send({
            message: "Invalid open drawer option! Must be boolean true or false."
        });
        return;
    }

    Option.findOne({
        where: {
            name: optionOpenDrawer
        }
    }).then(data => {
        if (data) {
            Option.update({value: openDrawerValue}, {
                where: {name: optionOpenDrawer}
            })
                .then(num => {
                    if (num.includes(1)) {
                        res.send({
                            message: "Open drawer option was updated successfully."
                        });
                    } else {
                        res.send({
                            message: `Cannot update open drawer option. Value: ${openDrawerValue}!`
                        });
                    }
                })
                .catch(err => {
                    res.status(500).send({
                        message: "Error updating open drawer value with " + openDrawerValue,
                        error: err
                    });
                });

            return;
        }

        Option.create({name: optionOpenDrawer, value: openDrawerValue})
            .then(data => {
                res.send({text: data.value});
            })
            .catch(err => {
                res.status(500).send({
                    message:
                        err.message || "Some error occurred while creating the option."
                });
            });
    });
}

export const getOpenDrawer = (req, res) => {
    return Option.findOne({
        where: {
            name: optionOpenDrawer
        }
    })
        .then(data => {
            if (data) {
                res.send({openDrawer: data.value === 'true' || data.value === true || data.value === 1 || data.value === '1'});
            } else {
                res.send({openDrawer: false});
            }
        })
        .catch(err => {
            res.status(500).send({
                message: "Error retrieving option: " + err.message
            });
        });
}

export const getPrintTypeVariable = async () => {
    const row = await Option.findOne({where: {name: optionPrintType}});
    return row?.value ?? 'totals';
}

export const getPrinterVariable = async () => {
    const row = await Option.findOne({where: {name: optionPrintName}})
    return row?.value ?? null;
}

export const getHeadersVariable = async () => {
    const rowFirstLine = await Option.findOne({where: {name: optionFirstLine}});

    const rowSecondLine = await Option.findOne({where: {name: optionSecondLine}});

    return {firstLine: rowFirstLine?.value ?? null, secondLine: rowSecondLine?.value ?? null};
}

export const getOnboardingStatus = async (req, res) => {
    try {
        const completed = await readOnboardingStatus();
        res.send({completed});
    } catch (err) {
        res.status(500).send({
            message: "Error retrieving onboarding status.",
            error: err?.message || err
        });
    }
};

export const getOpenDrawerVariable = async () => {
    const row = await Option.findOne({where: {name: optionOpenDrawer}});
    if (!row) return false;
    return row.value === 'true' || row.value === true || row.value === 1 || row.value === '1';
}

export const getFavoritesSettings = async (req, res) => {
    try {
        const enabledRows = await Option.findAll({where: {name: optionFavorites}});
        const countRows = await Option.findAll({where: {name: optionFavoritesCount}});

        if (enabledRows.length > 1) {
            const [primary, ...duplicates] = enabledRows;
            if (duplicates.length > 0) {
                await Option.destroy({where: {id: duplicates.map((row) => row.id)}});
            }
        }
        if (countRows.length > 1) {
            const [primary, ...duplicates] = countRows;
            if (duplicates.length > 0) {
                await Option.destroy({where: {id: duplicates.map((row) => row.id)}});
            }
        }

        const enabledRow = enabledRows[0] || null;
        const countRow = countRows[0] || null;
        res.send({
            enabled: enabledRow ? enabledRow.value === 'true' : false,
            count: countRow ? Number(countRow.value) || 6 : 6,
        });
    } catch (error) {
        res.status(500).send({
            message: "Error retrieving favorites settings.",
            error: error?.message || error,
        });
    }
};

export const setFavoritesSettings = async (req, res) => {
    try {
        const {enabled, count} = req.body;
        const normalizedEnabled = !!enabled;
        const normalizedCount = Number.isFinite(Number(count)) && Number(count) > 0 ? Number(count) : 6;

        const [favoritesOption] = await Option.findOrCreate({
            where: {name: optionFavorites},
            defaults: {value: String(normalizedEnabled)},
        });
        if (favoritesOption.value !== String(normalizedEnabled)) {
            await favoritesOption.update({value: String(normalizedEnabled)});
        }

        const [countOption] = await Option.findOrCreate({
            where: {name: optionFavoritesCount},
            defaults: {value: String(normalizedCount)},
        });
        if (countOption.value !== String(normalizedCount)) {
            await countOption.update({value: String(normalizedCount)});
        }

        res.send({enabled: normalizedEnabled, count: normalizedCount});
    } catch (error) {
        res.status(500).send({
            message: "Error saving favorites settings.",
            error: error?.message || error,
        });
    }
};
