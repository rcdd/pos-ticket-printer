import {Router} from 'express';
import * as orders from '../db/controllers/orders.controller.js';
import * as tables from '../db/controllers/tables.controller.js';
import {requireFeature, requireRole} from '../middleware/authorization.js';
import {UserRoles} from '../db/models/user.model.js';

const router = Router();

// O pagamento é exclusivo da caixa (UI principal)
const cashier = requireRole(UserRoles.ADMIN, UserRoles.CASHIER);

// A criação exige o modo multiposto ativo (licença + configuração).
// As leituras ficam sempre disponíveis para a caixa poder listar e cobrar
// pedidos existentes mesmo que o multiposto seja entretanto desativado.
const multi = requireFeature('multi');

router.post('/order', multi, orders.create);
router.post('/order/:id/reprint', orders.reprint);
router.post('/order/:id/pay', cashier, orders.pay);
router.post('/order/:id/cancel-items', orders.cancelItems);
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
