const express = require('express');
const router = express.Router();
const controller = require('../controllers/dispatchController');

router.post('/', controller.createDraft);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.get('/slip/:dispatchSlipNumber', controller.getBySlip);
router.put('/:id', controller.updateDraft);
router.patch('/:id/status', controller.updateStatus);
router.post('/:id/finalize', controller.finalizeDispatch);

module.exports = router;
