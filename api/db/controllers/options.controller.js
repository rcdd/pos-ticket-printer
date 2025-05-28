const db = require("../models");
const Option = db.options;

const optionPrintName = 'printer';
const optionFirstLine = 'firstLine';
const optionSecondLine = 'secondLine';
const optionPrintType = 'printOptionType';

exports.getPrinter = (req, res) => {
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
        .catch(err => {
            res.status(500).send({
                message: "Error retrieving printer"
            });
        });
}

exports.setPrinter = async (req, res) => {
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

exports.setHeaderFirstLine = (req, res) => {
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

exports.setHeaderSecondLine = (req, res) => {
    // Validate request
    if (!req.body.secondLine) {
        res.status(400).send({
            message: "Second line can not be empty!"
        });
        return;
    }

    const secondLine = req.body.secondLine;

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

exports.setTypePrint = (req, res) => {
    // Validate request
    if (!req.body.printType) {
        res.status(400).send({
            message: "Option must be defined!"
        });
        return;
    }

    const printOptionType = req.body.printType;

    if (printOptionType !== 'totals' && printOptionType !== 'tickets' && printOptionType !== 'both') {
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
            Option.update({value: printOptionType}, {
                where: {name: printOptionType}
            })
                .then(num => {
                    if (num.includes(1)) {
                        res.send({
                            message: "Print Totals options was updated successfully."
                        });
                    } else {
                        res.send({
                            message: `Cannot update print totals. Value: ${printOptionType}!`
                        });
                    }
                })
                .catch(err => {
                    res.status(500).send({
                        message: "Error updating print totals value with " + printOptionType,
                        error: err
                    });
                });

            return;
        }

        Option.create({name: optionPrintType, value: printOptionType})
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

exports.getHeaders = (req, res) => {
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
                    .catch(err => {
                        res.status(500).send({
                            message: "Error retrieving header"
                        });
                    });
            } else {
                res.send({firstLine: null, secondLine: null});
            }
        })
        .catch(err => {
            res.status(500).send({
                message: "Error retrieving header"
            });
        });
}

exports.getHeadersInit = () => {
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
                            return ({firstLine: _first.value, secondLine: _second.value});
                        } else {
                            return false;
                        }
                    })
                    .catch(err => {
                        return false;
                    });
            } else {
                return false;
            }
        })
        .catch(err => {
            return false;
        });
}

exports.getPrintType = (req, res) => {
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
                message: "Error retrieving option"
            });
        });
}