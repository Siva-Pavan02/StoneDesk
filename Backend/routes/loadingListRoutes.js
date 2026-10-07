const express = require('express');
const router = express.Router();
const controller = require('../controllers/loadingListController');
const { allowRoles } = require('../utils/auth');

router.get('/', controller.getLoadingLists);
router.get('/:id', controller.getLoadingListById);
router.post('/', allowRoles('Admin', 'YardManager', 'Dispatcher'), controller.createLoadingList);
router.put('/:id', allowRoles('Admin', 'YardManager', 'Dispatcher'), controller.updateLoadingList);
router.delete('/:id', allowRoles('Admin'), controller.deleteLoadingList);
router.patch('/:id/status', allowRoles('Admin', 'Dispatcher'), controller.updateStatus);

module.exports = router;
