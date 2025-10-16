export const UserRoles = Object.freeze({
    ADMIN: 'admin',
    CASHIER: 'cashier',
    WAITER: 'waiter',
});

export const USER_ROLE_OPTIONS = [
    {value: UserRoles.ADMIN, label: 'Administrador'},
    {value: UserRoles.CASHIER, label: 'Caixa'},
    {value: UserRoles.WAITER, label: 'Empregado'},
];

export function getRoleLabel(role) {
    const option = USER_ROLE_OPTIONS.find((opt) => opt.value === role);
    return option ? option.label : role;
}
