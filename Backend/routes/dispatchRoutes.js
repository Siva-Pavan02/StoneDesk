const express = require('express');
const router = express.Router();
const controller = require('../controllers/dispatchController');
const paymentController = require('../controllers/paymentController');
const { allowRoles } = require('../utils/auth');

router.post('/', controller.createDraft);
router.get('/', controller.list);
router.get('/analytics', controller.analytics);
router.get('/:id', controller.getById);
router.get('/:id/payments', paymentController.getPayments);
router.post('/:id/payments', allowRoles('Admin', 'Dispatcher'), paymentController.createPayment);
router.get('/slip/:dispatchSlipNumber', controller.getBySlip);
router.put('/:id/revise', allowRoles('Admin'), controller.reviseDispatch);
router.put('/:id', controller.updateDraft);
router.patch('/:id/status', allowRoles('Admin', 'Dispatcher'), controller.updateStatus);
router.post('/:id/finalize', allowRoles('Admin', 'Dispatcher'), controller.finalizeDispatch);
router.delete('/:id', allowRoles('Admin'), controller.deleteDispatch);

module.exports = router;
