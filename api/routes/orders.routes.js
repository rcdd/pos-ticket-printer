import {Router} from 'express';
import * as orders from '../db/controllers/orders.controller.js';
import * as tables from '../db/controllers/tables.controller.js';
import {requireFeature, requireRole} from '../middleware/authorization.js';
import {UserRoles} from '../db/models/user.model.js';

const router = Router();

// Payment is exclusive to the register (main UI)
const cashier = requireRole(UserRoles.ADMIN, UserRoles.CASHIER);

// Creating requires multi-terminal mode to be active (license + setting).
// Reads stay always available so the register can still list and charge
// existing orders even if multi-terminal gets disabled in the meantime.
const multi = requireFeature('multi');

router.post('/order', multi, orders.create);
router.post('/order/:id/reprint', orders.reprint);
router.post('/order/:id/pay', cashier, orders.pay);
router.post('/order/:id/cancel-items', orders.cancelItems);
router.post('/order/:id/move', cashier, orders.move);
router.get('/orders', orders.findAll);
router.get('/order/by-number/:number', orders.findByNumber);
router.get('/order/:id', orders.findOne);

router.post('/table', multi, tables.open);
router.get('/tables', tables.findAll);
router.get('/tables/by-number/:number', tables.findByNumber);
router.get('/table/:id', tables.findOne);
router.post('/table/:id/pay', cashier, tables.pay);
router.post('/table/:id/close-empty', multi, tables.closeEmpty);

export default router;
