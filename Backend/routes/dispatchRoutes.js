const express = require('express');
const router = express.Router();
const controller = require('../controllers/dispatchController');
const { allowRoles } = require('../utils/auth');

router.post('/', controller.createDraft);
router.get('/', controller.list);
router.get('/analytics', controller.analytics);
router.get('/:id', controller.getById);
router.get('/slip/:dispatchSlipNumber', controller.getBySlip);
router.put('/:id', controller.updateDraft);
router.patch('/:id/status', allowRoles('Admin', 'Dispatcher'), controller.updateStatus);
router.post('/:id/finalize', allowRoles('Admin', 'Dispatcher'), controller.finalizeDispatch);

module.exports = router;
